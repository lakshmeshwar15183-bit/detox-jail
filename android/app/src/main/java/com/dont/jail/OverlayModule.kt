package com.dont.jail

import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class OverlayModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "OverlayModule"

    private var overlayView: View? = null
    private var windowManager: WindowManager? = null

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            promise.resolve(Settings.canDrawOverlays(reactContext))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + reactContext.packageName))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR", e.message, e)
        }
    }

    @ReactMethod
    fun showOverlay(appName: String, promise: Promise) {
        try {
            if (overlayView != null) {
                promise.resolve(true)
                return
            }
            if (!Settings.canDrawOverlays(reactContext)) {
                promise.reject("NO_PERMISSION", "Overlay permission not granted")
                return
            }
            val wm = reactContext.getSystemService(WindowManager::class.java) as WindowManager
            windowManager = wm

            val overlay: View = try {
                LayoutInflater.from(reactContext).inflate(R.layout.overlay_jail, null)
            } catch (_: Exception) {
                createOverlayView(appName)
            }

            // set app name
            try {
                val tv = overlay.findViewById<TextView>(R.id.overlay_app_name)
                tv?.text = appName
            } catch (_: Exception) {}

            val btnOpen = overlay.findViewById<Button>(R.id.overlay_btn_open)
            btnOpen?.setOnClickListener {
                hideOverlayInternal()
                // launch DON'T
                val launch = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
                launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (launch != null) reactContext.startActivity(launch)
            }
            val btnClose = overlay.findViewById<Button>(R.id.overlay_btn_close)
            btnClose?.setOnClickListener {
                hideOverlayInternal()
            }

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
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR", e.message, e)
        }
    }

    private fun createOverlayView(appName: String): View {
        val ctx = reactContext
        val root = android.widget.LinearLayout(ctx).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xFF06080F.toInt())
            setPadding(48, 48, 48, 48)
        }
        val icon = TextView(ctx).apply {
            text = "▦"
            textSize = 48f
            setTextColor(0xFFEF4444.toInt())
            gravity = Gravity.CENTER
        }
        val title = TextView(ctx).apply {
            text = "$appName is in jail."
            textSize = 22f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 8)
        }
        val sub = TextView(ctx).apply {
            text = "You hit your limit. Open DON'T to break out with a task or ad."
            textSize = 12f
            setTextColor(0xFFAAB2D6.toInt())
            gravity = Gravity.CENTER
        }
        val btn = Button(ctx).apply {
            text = "Open DON'T → Unlock"
            setBackgroundColor(0xFFFFFFFF.toInt())
            setTextColor(0xFF06080F.toInt())
        }
        btn.setOnClickListener {
            hideOverlayInternal()
            val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
            launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (launch != null) ctx.startActivity(launch)
        }
        root.addView(icon)
        root.addView(title)
        root.addView(sub)
        root.addView(btn)
        return root
    }

    private fun hideOverlayInternal() {
        try {
            overlayView?.let { v ->
                windowManager?.removeView(v)
            }
        } catch (_: Exception) {}
        overlayView = null
    }

    @ReactMethod
    fun hideOverlay(promise: Promise) {
        try {
            hideOverlayInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR", e.message, e)
        }
    }

    @ReactMethod
    fun isShowing(promise: Promise) {
        promise.resolve(overlayView != null)
    }
}
