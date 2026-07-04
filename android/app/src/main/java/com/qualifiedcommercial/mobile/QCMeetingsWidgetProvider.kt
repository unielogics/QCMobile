package com.qualifiedcommercial.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class QCMeetingsWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { widgetId ->
      manager.updateAppWidget(widgetId, buildRemoteViews(context))
    }
  }

  companion object {
    const val PREFS_NAME = "qc_widget"
    const val SNAPSHOT_KEY = "snapshot"
    private val outputTimeFormatter = SimpleDateFormat("EEE h:mm a", Locale.US)

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, QCMeetingsWidgetProvider::class.java))
      ids.forEach { manager.updateAppWidget(it, buildRemoteViews(context)) }
    }

    private fun buildRemoteViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.qc_meetings_widget)
      val snapshot = readSnapshot(context)
      val meetings = snapshot?.optJSONArray("meetings") ?: JSONArray()
      val updatedAt = snapshot?.optString("updated_at").orEmpty()
      val pipelineCount = snapshot?.optInt("pipeline_count", -1) ?: -1

      views.setOnClickPendingIntent(R.id.widget_root, deepLinkIntent(context, "qcmobile://agent/(tabs)/calendar", 10))
      views.setOnClickPendingIntent(R.id.widget_refresh, deepLinkIntent(context, "qcmobile://agent/(tabs)/calendar", 11))
      views.setOnClickPendingIntent(R.id.widget_pipeline_tab, deepLinkIntent(context, "qcmobile://agent/(tabs)/pipeline", 12))
      views.setTextViewText(R.id.widget_updated, if (updatedAt.isNotBlank()) "Updated ${formatTime(updatedAt)}" else "Open app to sync")
      views.setTextViewText(R.id.widget_pipeline_count, if (pipelineCount >= 0) "Pipeline $pipelineCount" else "Pipeline")

      bindMeeting(views, R.id.widget_meeting_1, R.id.widget_meeting_1_title, R.id.widget_meeting_1_meta, meetings.optJSONObject(0), context, 20)
      bindMeeting(views, R.id.widget_meeting_2, R.id.widget_meeting_2_title, R.id.widget_meeting_2_meta, meetings.optJSONObject(1), context, 21)
      bindMeeting(views, R.id.widget_meeting_3, R.id.widget_meeting_3_title, R.id.widget_meeting_3_meta, meetings.optJSONObject(2), context, 22)

      val hasMeetings = meetings.length() > 0
      views.setViewVisibility(R.id.widget_empty, if (hasMeetings) View.GONE else View.VISIBLE)
      return views
    }

    private fun bindMeeting(
      views: RemoteViews,
      rowId: Int,
      titleId: Int,
      metaId: Int,
      item: JSONObject?,
      context: Context,
      requestCode: Int,
    ) {
      if (item == null) {
        views.setViewVisibility(rowId, View.GONE)
        return
      }
      views.setViewVisibility(rowId, View.VISIBLE)
      views.setTextViewText(titleId, item.optString("title", "Meeting"))
      val time = formatTime(item.optString("starts_at"))
      val source = item.optString("source").takeIf { it.isNotBlank() }
      views.setTextViewText(metaId, listOfNotNull(time.takeIf { it.isNotBlank() }, source).joinToString(" · "))
      views.setOnClickPendingIntent(rowId, deepLinkIntent(context, item.optString("deeplink", "qcmobile://agent/(tabs)/calendar"), requestCode))
    }

    private fun readSnapshot(context: Context): JSONObject? {
      val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(SNAPSHOT_KEY, null)
      return raw?.let {
        runCatching { JSONObject(it) }.getOrNull()
      }
    }

    private fun formatTime(value: String): String {
      if (value.isBlank()) return ""
      return runCatching {
        val parser = if (value.contains(".")) {
          SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        } else {
          SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        }
        parser.timeZone = TimeZone.getTimeZone("UTC")
        outputTimeFormatter.format(parser.parse(value)!!)
      }.getOrDefault("")
    }

    private fun deepLinkIntent(context: Context, url: String, requestCode: Int): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
        setPackage(context.packageName)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      return PendingIntent.getActivity(
        context,
        requestCode,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
