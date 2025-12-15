package com.meintv

import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import kotlinx.coroutines.delay
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

class KodiSearchWorker(
  appContext: android.content.Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result {
    val title = inputData.getString(KEY_TITLE) ?: return Result.failure()
    val host = inputData.getString(KEY_HOST) ?: return Result.failure()
    val port = inputData.getInt(KEY_PORT, 8080)
    val user = inputData.getString(KEY_USER)
    val pass = inputData.getString(KEY_PASS)
    val tmdbId = inputData.getLong(KEY_TMDB_ID, -1L).takeIf { it > 0 }
    val tmdbShowId = inputData.getLong(KEY_TMDB_SHOW_ID, -1L).takeIf { it > 0 }
    val season = inputData.getInt(KEY_SEASON, -1).takeIf { it >= 0 }
    val episode = inputData.getInt(KEY_EPISODE, -1).takeIf { it >= 0 }

    val encodedTitle = URLEncoder.encode(title, "UTF-8")
    val pluginUrl = when {
      tmdbShowId != null && season != null && episode != null ->
        "plugin://plugin.video.elementum/library/play/show/$tmdbShowId/season/$season/episode/$episode"
      tmdbId != null ->
        "plugin://plugin.video.elementum/library/play/movie/$tmdbId"
      else ->
        "plugin://plugin.video.elementum/movies/search?q=$encodedTitle"
    }

    // Best effort: launch Kodi so it's running
    try {
      val launch = applicationContext.packageManager.getLaunchIntentForPackage("org.xbmc.kodi")
      launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (launch != null) applicationContext.startActivity(launch)
    } catch (e: Exception) {
      Log.d(TAG, "Kodi launch failed: ${e.message}")
    }

    val authHeader = buildAuth(user, pass)
    val ready = waitForKodiReady(host, port, authHeader)
    if (!ready) {
      Log.d(TAG, "Kodi not ready after wait; retrying later")
      return Result.retry()
    }
    // Quick visual proof in Kodi UI
    sendJsonRpc(
      host,
      port,
      authHeader,
      """{"jsonrpc":"2.0","id":1,"method":"GUI.ShowNotification","params":{"title":"MeinTV","message":"Sending to Elementum..."}}""",
    )

    // Try playback or search
    val primary = """{"jsonrpc":"2.0","id":2,"method":"Player.Open","params":{"item":{"file":"$pluginUrl"}}}"""
    val secondarySearch =
      if (tmdbShowId != null) {
        """{"jsonrpc":"2.0","id":3,"method":"Player.Open","params":{"item":{"file":"plugin://plugin.video.elementum/search?q=$encodedTitle"}}}"""
      } else {
        """{"jsonrpc":"2.0","id":3,"method":"Player.Open","params":{"item":{"file":"plugin://plugin.video.elementum/movies/search?q=$encodedTitle"}}}"""
      }
    val tertiarySearch =
      """{"jsonrpc":"2.0","id":4,"method":"Player.Open","params":{"item":{"file":"plugin://plugin.video.elementum/search?q=$encodedTitle"}}}"""
    val burstType = if (tmdbShowId != null) "tv" else "movie"
    val burstFallback =
      """{"jsonrpc":"2.0","id":5,"method":"Addons.ExecuteAddon","params":{"addonid":"plugin.video.elementum","params":"?action=burst&search=$encodedTitle&type=$burstType","wait":false}}"""

    val okPrimary = sendJsonRpc(host, port, authHeader, primary)
    val okSecondary = if (!okPrimary) sendJsonRpc(host, port, authHeader, secondarySearch) else true
    val okTertiary = if (!okSecondary) sendJsonRpc(host, port, authHeader, tertiarySearch) else true
    if (!okTertiary) {
      sendJsonRpc(host, port, authHeader, burstFallback)
    }

    return Result.success()
  }

  private fun buildAuth(user: String?, pass: String?): String? {
    if (user.isNullOrBlank() || pass.isNullOrBlank()) return null
    val creds = "$user:$pass"
    val encoded = Base64.encodeToString(creds.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
    return "Basic $encoded"
  }

  private fun sendJsonRpc(host: String, port: Int, authHeader: String?, payload: String): Boolean {
    try {
      val url = URL("http://$host:$port/jsonrpc")
      val conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        setRequestProperty("Content-Type", "application/json")
        if (authHeader != null) setRequestProperty("Authorization", authHeader)
        doOutput = true
        connectTimeout = 4000
        readTimeout = 4000
      }

      OutputStreamWriter(conn.outputStream).use { it.write(payload) }
      val code = conn.responseCode
      Log.d(TAG, "Kodi JSON-RPC response code: $code")
      if (code !in 200..299) {
        conn.errorStream?.bufferedReader()?.use { br ->
          val body = br.readText()
          Log.d(TAG, "Kodi JSON-RPC error body: $body")
        }
      } else {
        conn.inputStream.use { _ -> }
      }
      return code in 200..299
    } catch (e: Exception) {
      Log.d(TAG, "Kodi JSON-RPC failed: ${e.message}")
    }
    return false
  }

  private suspend fun waitForKodiReady(
    host: String,
    port: Int,
    authHeader: String?,
    timeoutMs: Long = 30000,
    stepMs: Long = 1200,
  ): Boolean {
    val pingPayload = """{"jsonrpc":"2.0","id":0,"method":"JSONRPC.Ping"}"""
    val start = System.currentTimeMillis()
    while (System.currentTimeMillis() - start < timeoutMs) {
      val ok = sendJsonRpc(host, port, authHeader, pingPayload)
      if (ok) return true
      delay(stepMs)
    }
    return false
  }

  companion object {
    const val KEY_TITLE = "title"
    const val KEY_HOST = "host"
    const val KEY_PORT = "port"
    const val KEY_USER = "user"
    const val KEY_PASS = "pass"
    const val KEY_TMDB_ID = "tmdb_id"
    const val KEY_TMDB_SHOW_ID = "tmdb_show_id"
    const val KEY_SEASON = "season"
    const val KEY_EPISODE = "episode"
    private const val TAG = "KodiSearchWorker"

    fun data(
      title: String,
      host: String,
      port: Int,
      user: String?,
      pass: String?,
      tmdbId: Long?,
      tmdbShowId: Long?,
      season: Int?,
      episode: Int?,
    ): Data {
      return Data.Builder()
        .putString(KEY_TITLE, title)
        .putString(KEY_HOST, host)
        .putInt(KEY_PORT, port)
        .putString(KEY_USER, user)
        .putString(KEY_PASS, pass)
        .putLong(KEY_TMDB_ID, tmdbId ?: -1L)
        .putLong(KEY_TMDB_SHOW_ID, tmdbShowId ?: -1L)
        .putInt(KEY_SEASON, season ?: -1)
        .putInt(KEY_EPISODE, episode ?: -1)
        .build()
    }
  }
}
