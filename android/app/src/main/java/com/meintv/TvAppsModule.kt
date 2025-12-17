package com.meintv

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.content.pm.PackageManager.ResolveInfoFlags
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Base64
import android.content.Context
import org.json.JSONArray
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class TvAppsModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "TvApps"

  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    try {
      val pm = reactContext.packageManager
      val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
        .sortedBy { pm.getApplicationLabel(it).toString().lowercase() }

      val result = Arguments.createArray()

      for (appInfo in apps) {
        val pkg = appInfo.packageName
        val label = pm.getApplicationLabel(appInfo).toString()

        val launchIntent = try {
          pm.getLeanbackLaunchIntentForPackage(pkg) ?: pm.getLaunchIntentForPackage(pkg)
        } catch (_: Exception) {
          null
        }
        if (launchIntent == null) continue

        val map = Arguments.createMap()
        map.putString("packageName", pkg)
        map.putString("label", label)

        try {
          val bannerResId = appInfo.banner ?: 0
          if (bannerResId != 0) {
            val res = pm.getResourcesForApplication(appInfo)
            val bannerDrawable = res.getDrawable(bannerResId, null)

            val bannerBmp: Bitmap? = when (bannerDrawable) {
              is BitmapDrawable -> bannerDrawable.bitmap
              else -> {
                val w = bannerDrawable.intrinsicWidth
                val h = bannerDrawable.intrinsicHeight
                if (w > 0 && h > 0) {
                  val outBmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                  val canvas = Canvas(outBmp)
                  bannerDrawable.setBounds(0, 0, canvas.width, canvas.height)
                  bannerDrawable.draw(canvas)
                  outBmp
                } else null
              }
            }

            bannerBmp?.let { bmp ->
              val stream = ByteArrayOutputStream()
              bmp.compress(Bitmap.CompressFormat.PNG, 100, stream)
              val bytes = stream.toByteArray()
              val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
              map.putString("banner", "data:image/png;base64,$base64")
            }
          }
        } catch (_: Exception) {
        }

        try {
          val iconDrawable = pm.getApplicationIcon(appInfo)

          val bmp: Bitmap? = when (iconDrawable) {
            is BitmapDrawable -> iconDrawable.bitmap
            else -> {
              val w = iconDrawable.intrinsicWidth
              val h = iconDrawable.intrinsicHeight
              if (w > 0 && h > 0) {
                val outBmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(outBmp)
                iconDrawable.setBounds(0, 0, canvas.width, canvas.height)
                iconDrawable.draw(canvas)
                outBmp
              } else null
            }
          }

          bmp?.let {
            val stream = ByteArrayOutputStream()
            it.compress(Bitmap.CompressFormat.PNG, 100, stream)
            val bytes = stream.toByteArray()
            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            map.putString("icon", "data:image/png;base64,$base64")
          }
        } catch (_: Exception) {
        }

        result.pushMap(map)
      }

      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("APPS_ERROR", e)
    }
  }


  @ReactMethod
  fun launchApp(packageName: String, promise: Promise) {
    try {
      val pm = reactContext.packageManager
      // Prefer Leanback intent on Android TV but fall back to regular launcher
      val leanbackIntent = try {
        pm.getLeanbackLaunchIntentForPackage(packageName)
      } catch (_: Exception) {
        null
      }
      val intent = leanbackIntent ?: pm.getLaunchIntentForPackage(packageName)

      if (intent != null) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
        promise.resolve(true)
      } else {
        promise.reject("NO_INTENT", "No launch intent for $packageName")
      }
    } catch (e: Exception) {
      promise.reject("LAUNCH_ERROR", e)
    }
  }

  @ReactMethod
  fun openSystemSettings() {
    val intent = Intent(Settings.ACTION_SETTINGS)
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    reactContext.startActivity(intent)
  }

  @ReactMethod
  fun openKodiPlugin(pluginUrl: String, promise: Promise) {
    try {
      val intent = Intent(Intent.ACTION_VIEW).apply {
        data = Uri.parse(pluginUrl)
        setPackage("org.xbmc.kodi")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("KODI_PLUGIN_ERROR", e)
    }
  }

  @ReactMethod
  fun searchElementum(
    title: String,
    host: String,
    port: Int,
    user: String?,
    pass: String?,
    tmdbId: Double?,
    tmdbShowId: Double?,
    season: Double?,
    episode: Double?,
    promise: Promise,
  ) {
    try {
      val work = OneTimeWorkRequestBuilder<KodiSearchWorker>()
        .setInputData(
          KodiSearchWorker.data(
            title = title,
            host = host,
            port = port,
            user = user,
            pass = pass,
            tmdbId = tmdbId?.toLong(),
            tmdbShowId = tmdbShowId?.toLong(),
            season = season?.toInt(),
            episode = episode?.toInt(),
          ),
        )
        .build()
      WorkManager.getInstance(reactContext)
        .enqueueUniqueWork(
          "kodi_search_elementum",
          ExistingWorkPolicy.REPLACE,
          work,
        )
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("KODI_ELEMENTUM_ERROR", e)
    }
  }

  @ReactMethod
  fun getFavoritePackages(promise: Promise) {
    try {
      val prefs = reactContext.getSharedPreferences("meintv_prefs", Context.MODE_PRIVATE)
      val raw = prefs.getString("favorite_apps", "[]") ?: "[]"
      val array = Arguments.createArray()
      try {
        val parsed = JSONArray(raw)
        for (i in 0 until parsed.length()) {
          val item = parsed.optString(i, null)
          if (item != null) array.pushString(item)
        }
      } catch (_: Exception) {
      }
      promise.resolve(array)
    } catch (e: Exception) {
      promise.reject("FAV_GET_ERROR", e)
    }
  }

  @ReactMethod
  fun setFavoritePackages(packages: ReadableArray, promise: Promise) {
    try {
      val list = mutableListOf<String>()
      for (i in 0 until packages.size()) {
        val p = packages.getString(i)
        if (p != null) list.add(p)
      }
      val json = JSONArray(list).toString()
      val prefs = reactContext.getSharedPreferences("meintv_prefs", Context.MODE_PRIVATE)
      prefs.edit().putString("favorite_apps", json).apply()
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("FAV_SET_ERROR", e)
    }
  }
}
