package com.qualifiedcommercial.mobile

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class QCWidgetDataModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "QCWidgetData"

  @ReactMethod
  fun setWidgetData(json: String) {
    reactContext
      .getSharedPreferences(QCMeetingsWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(QCMeetingsWidgetProvider.SNAPSHOT_KEY, json)
      .apply()
    QCMeetingsWidgetProvider.updateAll(reactContext)
  }
}

