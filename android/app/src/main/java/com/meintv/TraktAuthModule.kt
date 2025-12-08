package com.meintv

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class TraktAuthModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "TraktAuth"

  private val clientId = BuildConfig.TRAKT_CLIENT_ID
  private val clientSecret = BuildConfig.TRAKT_CLIENT_SECRET
  init {
    if (clientId.isBlank() || clientSecret.isBlank()) {
      throw IllegalStateException("Trakt credentials are missing. Set TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET in your environment.")
    }
  }
  private val prefs by lazy {
    reactContext.getSharedPreferences("meintv_trakt", Context.MODE_PRIVATE)
  }

  @ReactMethod
  fun requestDeviceCode(promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val payload = JSONObject()
        payload.put("client_id", clientId)

        val response = postJson("https://api.trakt.tv/oauth/device/code", payload.toString())
        promise.resolve(response)
      } catch (e: Exception) {
        promise.reject("DEVICE_CODE_ERROR", e)
      }
    }
  }

  @ReactMethod
  fun pollForToken(deviceCode: String, promise: Promise) {
    CoroutineScope(Dispatchers.IO).launch {
      try {
        val payload = JSONObject()
        payload.put("code", deviceCode)
        payload.put("client_id", clientId)
        payload.put("client_secret", clientSecret)

        val response = postJson("https://api.trakt.tv/oauth/device/token", payload.toString())
        // store token
        prefs.edit().putString("token", JSONObject(response).toString()).apply()
        promise.resolve(response)
      } catch (e: Exception) {
        promise.reject("DEVICE_TOKEN_ERROR", e)
      }
    }
  }

  @ReactMethod
  fun getStoredToken(promise: Promise) {
    try {
      val raw = prefs.getString("token", null) ?: return promise.resolve(null)
      promise.resolve(raw)
    } catch (e: Exception) {
      promise.reject("TOKEN_READ_ERROR", e)
    }
  }

  @ReactMethod
  fun clearToken(promise: Promise) {
    prefs.edit().remove("token").apply()
    promise.resolve(true)
  }

  private fun postJson(urlStr: String, body: String): String {
    val url = URL(urlStr)
    val conn = (url.openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("trakt-api-version", "2")
      setRequestProperty("trakt-api-key", clientId)
      doOutput = true
      connectTimeout = 5000
      readTimeout = 5000
    }

    OutputStreamWriter(conn.outputStream).use { it.write(body) }

    val code = conn.responseCode
    val stream = if (code in 200..299) conn.inputStream else conn.errorStream
    val response = stream.bufferedReader().use(BufferedReader::readText)
    if (code !in 200..299) {
      Log.d("TraktAuth", "Error response $code: $response")
      throw Exception("Trakt error $code")
    }
    return response
  }
}
