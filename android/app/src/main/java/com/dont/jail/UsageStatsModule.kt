package com.dont.jail

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class UsageStatsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "UsageStatsModule"

    @ReactMethod
    fun isUsageAccessGranted(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), reactApplicationContext.packageName)
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getForegroundApp(promise: Promise) {
        try {
            val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val end = System.currentTimeMillis()
            val start = end - 5000 // last 5 sec
            val events = usm.queryEvents(start, end)
            var lastPackage: String? = null
            var lastTime: Long = 0
            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (event.timeStamp > lastTime) {
                        lastTime = event.timeStamp
                        lastPackage = event.packageName
                    }
                }
            }
            promise.resolve(lastPackage)
        } catch (e: Exception) {
            promise.reject("ERR", e.message, e)
        }
    }

    @ReactMethod
    fun getAppUsage(packageName: String, promise: Promise) {
        try {
            val usm = reactApplicationContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
            val end = System.currentTimeMillis()
            // start of today 00:00
            val cal = java.util.Calendar.getInstance()
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
            cal.set(java.util.Calendar.MINUTE, 0)
            cal.set(java.util.Calendar.SECOND, 0)
            cal.set(java.util.Calendar.MILLISECOND, 0)
            val start = cal.timeInMillis
            val stats: List<UsageStats> = usm.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, end)
            var total: Long = 0
            for (s in stats) {
                if (s.packageName == packageName) {
                    total = s.totalTimeInForeground
                    break
                }
            }
            // also try queryEvents to sum for today if stats empty (some OEMs)
            if (total == 0L) {
                val events = usm.queryEvents(start, end)
                val event = UsageEvents.Event()
                var lastForeground: Long = 0
                var pkg: String? = null
                while (events.hasNextEvent()) {
                    events.getNextEvent(event)
                    if (event.packageName == packageName) {
                        if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                            lastForeground = event.timeStamp
                            pkg = event.packageName
                        } else if (event.eventType == UsageEvents.Event.MOVE_TO_BACKGROUND && pkg == packageName && lastForeground != 0L) {
                            total += event.timeStamp - lastForeground
                            lastForeground = 0
                            pkg = null
                        }
                    }
                }
            }
            promise.resolve((total / 60000).toDouble()) // minutes
        } catch (e: Exception) {
            promise.reject("ERR", e.message, e)
        }
    }
}
