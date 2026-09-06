package com.dont.jail

import android.app.*
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.core.app.NotificationCompat

class JailService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var runnable: Runnable? = null
    private var jailedApps: Map<String, AppInfo> = emptyMap()
    private var overlayView: View? = null
    private var windowManager: WindowManager? = null

    data class AppInfo(val name: String, val packageName: String, val limitMin: Int)

    companion object {
        var instance: JailService? = null
        const val NOTIF_ID = 1001
        const val CHANNEL_ID = "dont_jail_service"
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createChannel()
        windowManager = getSystemService(WindowManager::class.java) as WindowManager
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        hideOverlay()
        instance = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val appsJson = intent?.getStringExtra("appsJson")
        if (appsJson != null) {
            try {
                val json = org.json.JSONObject(appsJson)
                val map = mutableMapOf<String, AppInfo>()
                val keys = json.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    val obj = json.getJSONObject(k)
                    map[k] = AppInfo(
                        name = obj.optString("name", k),
                        packageName = obj.optString("packageName", ""),
                        limitMin = obj.optInt("limitMin", 30)
                    )
                }
                jailedApps = map
            } catch (_: Exception) {}
        }
        val action = intent?.getStringExtra("action")
        if (action == "stop") {
            hideOverlay()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        startForeground(NOTIF_ID, buildNotification())
        startPolling()
        return START_STICKY
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "DON'T Jail Monitor", NotificationManager.IMPORTANCE_LOW)
            ch.description = "Keeps jail active to block apps when limit hit"
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification {
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        val pending = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("DON'T is watching")
            .setContentText(if (jailedApps.isEmpty()) "No apps jailed" else "Watching ${jailedApps.size} apps • Tap to open DON'T")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pending)
            .build()
    }

    private fun startPolling() {
        handler.removeCallbacksAndMessages(null)
        runnable = object : Runnable {
            override fun run() {
                pollOnce()
                handler.postDelayed(this, 1200)
            }
        }
        handler.post(runnable!!)
    }

    private fun pollOnce() {
        try {
            if (jailedApps.isEmpty()) {
                hideOverlay()
                return
            }
            val fg = getForegroundPackage() ?: return
            // check if foreground is any jailed app -> block immediately (manual jail)
            for ((_, info) in jailedApps) {
                if (info.packageName == fg) {
                    // For manual jail, block immediately. For limit-based, also check used >= limit
                    // We treat any jailed entry as should block when foreground, regardless of used time
                    // To respect limit, we could check used time, but manual jail should block immediately
                    // So we block if fg matches any jailed app
                    showOverlay(info.name)
                    return
                }
            }
            // if foreground is not jailed, hide overlay if showing
            // Only hide if overlay is showing and fg is not DON'T itself
            if (fg != packageName) {
                // keep overlay if still showing? Actually hide when user leaves jailed app
                // The overlay's button will hide when user taps, but if they press home, we should hide
                // We check if overlay is showing and fg != jailed app, hide
                if (overlayView != null) {
                    // Don't hide immediately if fg is DON'T (user opened DON'T to unlock)
                    if (fg == packageName) {
                        // keep showing until user unlocks via DON'T UI which will stop service
                    } else {
                        // fg is other app not jailed, hide
                        hideOverlay()
                    }
                }
            }
        } catch (_: Exception) {}
    }

    private fun getForegroundPackage(): String? {
        return try {
            val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val end = System.currentTimeMillis()
            val start = end - 5000
            val events = usm.queryEvents(start, end)
            var lastPkg: String? = null
            var lastTime: Long = 0
            val e = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(e)
                if (e.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (e.timeStamp > lastTime) {
                        lastTime = e.timeStamp
                        lastPkg = e.packageName
                    }
                }
            }
            lastPkg
        } catch (_: Exception) { null }
    }

    private fun showOverlay(appName: String) {
        if (overlayView != null) return
        try {
            val wm = windowManager ?: getSystemService(WindowManager::class.java) as WindowManager
            windowManager = wm
            val overlay: View = try {
                LayoutInflater.from(this).inflate(R.layout.overlay_jail, null)
            } catch (_: Exception) {
                createOverlayView(appName)
            }
            try {
                val tv = overlay.findViewById<TextView>(R.id.overlay_app_name)
                tv?.text = appName
            } catch (_: Exception) {}
            val btnOpen = overlay.findViewById<Button>(R.id.overlay_btn_open)
            btnOpen?.setOnClickListener {
                hideOverlay()
                val launch = packageManager.getLaunchIntentForPackage(packageName)
                launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (launch != null) startActivity(launch)
            }
            val btnClose = overlay.findViewById<Button>(R.id.overlay_btn_close)
            btnClose?.setOnClickListener { hideOverlay() }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT
            )
            params.gravity = Gravity.CENTER
            wm.addView(overlay, params)
            overlayView = overlay
        } catch (_: Exception) {}
    }

    private fun createOverlayView(appName: String): View {
        val root = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xFF06080F.toInt())
            setPadding(48, 48, 48, 48)
        }
        val icon = TextView(this).apply {
            text = "▦"
            textSize = 48f
            setTextColor(0xFFEF4444.toInt())
            gravity = Gravity.CENTER
        }
        val title = TextView(this).apply {
            text = "$appName is in jail."
            textSize = 22f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 8)
        }
        val sub = TextView(this).apply {
            text = "You hit your limit. Open DON'T to break out."
            textSize = 12f
            setTextColor(0xFFAAB2D6.toInt())
            gravity = Gravity.CENTER
        }
        val btn = Button(this).apply {
            text = "Open DON'T → Unlock"
            setBackgroundColor(0xFFFFFFFF.toInt())
            setTextColor(0xFF06080F.toInt())
        }
        btn.setOnClickListener {
            hideOverlay()
            val launch = packageManager.getLaunchIntentForPackage(packageName)
            launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (launch != null) startActivity(launch)
        }
        root.addView(icon)
        root.addView(title)
        root.addView(sub)
        root.addView(btn)
        return root
    }

    private fun hideOverlay() {
        try {
            overlayView?.let { v -> windowManager?.removeView(v) }
        } catch (_: Exception) {}
        overlayView = null
    }
}
