package lk.udenisspecials.bakery;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.view.WindowManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "KitchenAlarm",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class KitchenAlarmPlugin extends Plugin {
    public static final String REMINDER_CHANNEL_ID = "kitchen_reminders_channel";
    public static final String REMINDER_GROUP_KEY = "udenis_kitchen_reminders";
    public static final int REMINDER_SUMMARY_ID = 49999;

    private static KitchenAlarmPlugin activeInstance;

    @Override
    public void load() {
        activeInstance = this;
        KitchenAlarmService.ensureChannel(getContext());
        ensureReminderChannel(getContext());
        if (getActivity() != null && getActivity().getIntent() != null) {
            handleReminderIntent(getContext(), getActivity().getIntent());
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (activeInstance == this) {
            activeInstance = null;
        }
        super.handleOnDestroy();
    }

    public static int reminderNotifId(String reminderId) {
        return 50000 + Math.abs(reminderId.hashCode() % 10000);
    }

    private static void ensureReminderChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(REMINDER_CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            REMINDER_CHANNEL_ID,
            "Kitchen Reminders",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Order deadlines, shortages, payment reminders, and backup alerts");
        channel.setShowBadge(true);
        manager.createNotificationChannel(channel);
    }

    public static void handleReminderIntent(Context context, Intent intent) {
        if (intent == null) return;

        String alarmId = intent.getStringExtra(KitchenAlarmService.EXTRA_ALARM_ID);
        if (alarmId != null && !alarmId.isEmpty()) {
            intent.removeExtra(KitchenAlarmService.EXTRA_ALARM_ID);
            KitchenReminderReceiver.recordAndDispatchEvent(
                context,
                "open-alarm",
                alarmId,
                null,
                null,
                null,
                null
            );
        }

        String reminderId = intent.getStringExtra(KitchenReminderReceiver.EXTRA_REMINDER_ID);
        if (reminderId == null || reminderId.isEmpty()) return;

        String orderId = intent.getStringExtra(KitchenReminderReceiver.EXTRA_ORDER_ID);
        String targetTab = intent.getStringExtra(KitchenReminderReceiver.EXTRA_TARGET_TAB);
        String starterAction = intent.getStringExtra(KitchenReminderReceiver.EXTRA_STARTER_ACTION);

        intent.removeExtra(KitchenReminderReceiver.EXTRA_REMINDER_ID);
        intent.removeExtra(KitchenReminderReceiver.EXTRA_ORDER_ID);
        intent.removeExtra(KitchenReminderReceiver.EXTRA_TARGET_TAB);
        intent.removeExtra(KitchenReminderReceiver.EXTRA_STARTER_ACTION);

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.cancel(reminderNotifId(reminderId));
        }
        Set<String> posted = new HashSet<>(KitchenReminderReceiver.getPostedIds(context));
        posted.remove(reminderId);
        KitchenReminderReceiver.savePostedIds(context, posted);
        if (nm != null && posted.size() < 2) {
            nm.cancel(REMINDER_SUMMARY_ID);
        }

        KitchenReminderReceiver.recordAndDispatchEvent(
            context,
            "open",
            reminderId,
            null,
            orderId,
            targetTab,
            starterAction
        );
    }

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        String alarmId = call.getString("alarmId");
        Double triggerAtDouble = call.getDouble("triggerAtMs");
        String title = call.getString("title", "Kitchen Timer");
        String body = call.getString("body", "Step timer is up!");

        if (alarmId == null || alarmId.isEmpty() || triggerAtDouble == null) {
            call.reject("Missing alarmId or triggerAtMs");
            return;
        }

        long triggerAtMs = triggerAtDouble.longValue();
        KitchenAlarmReceiver.scheduleExact(getContext(), alarmId, triggerAtMs, title, body);
        call.resolve();
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String alarmId = call.getString("alarmId");
        if (alarmId != null && !alarmId.isEmpty()) {
            KitchenAlarmReceiver.cancelExact(getContext(), alarmId);
            SharedPreferences prefs = getContext().getSharedPreferences(
                KitchenAlarmService.PREFS_NAME,
                Context.MODE_PRIVATE
            );
            String currentRinging = prefs.getString(KitchenAlarmService.KEY_RINGING_ID, null);
            if (alarmId.equals(currentRinging)) {
                stopServiceNow(alarmId);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void stopAlarm(PluginCall call) {
        String alarmId = call.getString("alarmId");
        stopServiceNow(alarmId);
        call.resolve();
    }

    @PluginMethod
    public void getRingingState(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            KitchenAlarmService.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String alarmId = prefs.getString(KitchenAlarmService.KEY_RINGING_ID, null);
        JSObject result = new JSObject();
        if (alarmId != null && !alarmId.isEmpty()) {
            result.put("ringing", true);
            result.put("alarmId", alarmId);
            result.put("title", prefs.getString(KitchenAlarmService.KEY_RINGING_TITLE, "Kitchen Timer"));
            result.put("body", prefs.getString(KitchenAlarmService.KEY_RINGING_BODY, "Step timer is up!"));
        } else {
            result.put("ringing", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void setKeepScreenOn(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            if (enabled) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void getNotificationPermissionStatus(PluginCall call) {
        boolean granted = isNotificationPermissionGranted();
        JSObject res = new JSObject();
        res.put("granted", granted);
        call.resolve(res);
    }

    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        if (isNotificationPermissionGranted()) {
            JSObject res = new JSObject();
            res.put("granted", true);
            call.resolve(res);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
    }

    private boolean isNotificationPermissionGranted() {
        Context context = getContext();
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        boolean granted = isNotificationPermissionGranted();
        JSObject res = new JSObject();
        res.put("granted", granted);
        call.resolve(res);
    }

    @PluginMethod
    public void syncReminderNotifications(PluginCall call) {
        Context context = getContext();
        ensureReminderChannel(context);

        if (!isNotificationPermissionGranted()) {
            JSObject res = new JSObject();
            res.put("posted", 0);
            res.put("permissionGranted", false);
            call.resolve(res);
            return;
        }

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) {
            call.resolve(new JSObject().put("posted", 0).put("permissionGranted", true));
            return;
        }

        JSArray reminders = call.getArray("reminders");
        Set<String> prevPosted = KitchenReminderReceiver.getPostedIds(context);
        Set<String> nextPosted = new HashSet<>();
        Bitmap largeIcon = BitmapFactory.decodeResource(
            context.getResources(),
            R.mipmap.ic_launcher_round
        );

        int count = reminders != null ? reminders.length() : 0;
        for (int i = 0; i < count; i++) {
            try {
                JSONObject item = reminders.getJSONObject(i);
                String id = item.optString("id", "");
                String title = item.optString("title", "Kitchen reminder");
                String detail = item.optString("detail", "");
                String targetTab = item.optString("targetTab", "today");
                String orderId = item.has("orderId") && !item.isNull("orderId") ? item.optString("orderId", "") : "";
                String starterAction = item.has("starterAction") && !item.isNull("starterAction") ? item.optString("starterAction", "") : "";

                if (id.isEmpty()) continue;
                nextPosted.add(id);

                int notifId = reminderNotifId(id);

                Intent openIntent = new Intent(context, MainActivity.class);
                openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                openIntent.putExtra(KitchenReminderReceiver.EXTRA_REMINDER_ID, id);
                openIntent.putExtra(KitchenReminderReceiver.EXTRA_TARGET_TAB, targetTab);
                if (!orderId.isEmpty()) {
                    openIntent.putExtra(KitchenReminderReceiver.EXTRA_ORDER_ID, orderId);
                }
                if (!starterAction.isEmpty()) {
                    openIntent.putExtra(KitchenReminderReceiver.EXTRA_STARTER_ACTION, starterAction);
                }
                PendingIntent openPending = PendingIntent.getActivity(
                    context,
                    notifId + 10,
                    openIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                Intent readIntent = new Intent(context, KitchenReminderReceiver.class);
                readIntent.setAction(KitchenReminderReceiver.ACTION_REMINDER_READ);
                readIntent.putExtra(KitchenReminderReceiver.EXTRA_REMINDER_ID, id);
                PendingIntent readPending = PendingIntent.getBroadcast(
                    context,
                    notifId + 20,
                    readIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                Intent clearIntent = new Intent(context, KitchenReminderReceiver.class);
                clearIntent.setAction(KitchenReminderReceiver.ACTION_REMINDER_CLEAR);
                clearIntent.putExtra(KitchenReminderReceiver.EXTRA_REMINDER_ID, id);
                PendingIntent clearPending = PendingIntent.getBroadcast(
                    context,
                    notifId + 30,
                    clearIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, REMINDER_CHANNEL_ID)
                    .setSmallIcon(R.drawable.ic_stat_bakery)
                    .setColor(0xFF9F1239)
                    .setLargeIcon(largeIcon)
                    .setContentTitle(title)
                    .setContentText(detail)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(detail))
                    .setGroup(REMINDER_GROUP_KEY)
                    .setOnlyAlertOnce(true)
                    .setAutoCancel(true)
                    .setContentIntent(openPending)
                    .setDeleteIntent(clearPending)
                    .addAction(0, "Mark read", readPending)
                    .addAction(0, "Clear", clearPending);

                nm.notify(notifId, builder.build());
            } catch (Exception ignored) {
            }
        }

        // Cancel any previously active notifications that are now read, cleared, or resolved in-app
        for (String oldId : prevPosted) {
            if (!nextPosted.contains(oldId)) {
                nm.cancel(reminderNotifId(oldId));
            }
        }

        if (nextPosted.size() >= 2) {
            Intent clearAllIntent = new Intent(context, KitchenReminderReceiver.class);
            clearAllIntent.setAction(KitchenReminderReceiver.ACTION_REMINDER_CLEAR_ALL);
            PendingIntent clearAllPending = PendingIntent.getBroadcast(
                context,
                REMINDER_SUMMARY_ID + 1,
                clearAllIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Intent openSummary = new Intent(context, MainActivity.class);
            openSummary.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent openSummaryPending = PendingIntent.getActivity(
                context,
                REMINDER_SUMMARY_ID + 2,
                openSummary,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            NotificationCompat.Builder summary = new NotificationCompat.Builder(context, REMINDER_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_bakery)
                .setColor(0xFF9F1239)
                .setLargeIcon(largeIcon)
                .setContentTitle("Udeni's Specials")
                .setContentText(nextPosted.size() + " kitchen reminders")
                .setGroup(REMINDER_GROUP_KEY)
                .setGroupSummary(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(openSummaryPending)
                .setDeleteIntent(clearAllPending)
                .addAction(0, "Clear all", clearAllPending);

            nm.notify(REMINDER_SUMMARY_ID, summary.build());
        } else {
            nm.cancel(REMINDER_SUMMARY_ID);
        }

        KitchenReminderReceiver.savePostedIds(context, nextPosted);

        JSObject res = new JSObject();
        res.put("posted", nextPosted.size());
        res.put("permissionGranted", true);
        call.resolve(res);
    }

    @PluginMethod
    public void clearAllSyncedReminders(PluginCall call) {
        Context context = getContext();
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) {
            for (String id : KitchenReminderReceiver.getPostedIds(context)) {
                nm.cancel(reminderNotifId(id));
            }
            nm.cancel(REMINDER_SUMMARY_ID);
        }
        KitchenReminderReceiver.savePostedIds(context, new HashSet<>());
        call.resolve();
    }

    @PluginMethod
    public void consumePendingReminderEvents(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            KitchenReminderReceiver.PREFS_NAME,
            Context.MODE_PRIVATE
        );
        String raw = prefs.getString(KitchenReminderReceiver.KEY_PENDING_EVENTS, "[]");
        prefs.edit().remove(KitchenReminderReceiver.KEY_PENDING_EVENTS).apply();

        JSArray events = new JSArray();
        try {
            JSONArray parsed = new JSONArray(raw);
            for (int i = 0; i < parsed.length(); i++) {
                events.put(JSObject.fromJSONObject(parsed.getJSONObject(i)));
            }
        } catch (Exception ignored) {
        }

        JSObject res = new JSObject();
        res.put("events", events);
        call.resolve(res);
    }

    private void stopServiceNow(String alarmId) {
        KitchenAlarmService.clearRingingPrefs(getContext());
        Intent stopIntent = new Intent(getContext(), KitchenAlarmService.class);
        stopIntent.setAction(KitchenAlarmService.ACTION_STOP);
        if (alarmId != null) {
            stopIntent.putExtra(KitchenAlarmService.EXTRA_ALARM_ID, alarmId);
        }
        getContext().stopService(stopIntent);
    }

    public static void notifyAlarmRinging(String alarmId, String title, String body) {
        if (activeInstance == null) return;
        JSObject data = new JSObject();
        data.put("alarmId", alarmId);
        data.put("title", title);
        data.put("body", body);
        activeInstance.notifyListeners("alarmRinging", data, true);
    }

    public static void notifyAlarmStopped(String alarmId) {
        if (activeInstance == null) return;
        JSObject data = new JSObject();
        data.put("alarmId", alarmId);
        activeInstance.notifyListeners("alarmStopped", data, true);
    }

    public static void notifyAlarmSnoozed(String alarmId, long nextTriggerMs) {
        if (activeInstance == null) return;
        JSObject data = new JSObject();
        data.put("alarmId", alarmId);
        data.put("triggerAtMs", nextTriggerMs);
        activeInstance.notifyListeners("alarmSnoozed", data, true);
    }

    public static boolean notifyReminderEventIfActive(JSONObject rawEvent) {
        if (activeInstance == null) return false;
        try {
            JSObject data = JSObject.fromJSONObject(rawEvent);
            activeInstance.notifyListeners("reminderAction", data, true);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
