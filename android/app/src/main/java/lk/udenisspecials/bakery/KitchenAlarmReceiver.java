package lk.udenisspecials.bakery;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.ContextCompat;

public class KitchenAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String alarmId = intent.getStringExtra(KitchenAlarmService.EXTRA_ALARM_ID);
        String title = intent.getStringExtra(KitchenAlarmService.EXTRA_TITLE);
        String body = intent.getStringExtra(KitchenAlarmService.EXTRA_BODY);

        if (alarmId == null || alarmId.isEmpty()) alarmId = "kitchen-timer";
        if (title == null || title.isEmpty()) title = "Kitchen Timer";
        if (body == null || body.isEmpty()) body = "Step timer is up!";

        if (KitchenAlarmService.ACTION_STOP.equals(action)) {
            KitchenAlarmService.clearRingingPrefs(context);
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.cancel(KitchenAlarmService.NOTIFICATION_ID);
            }
            try {
                Intent stopService = new Intent(context, KitchenAlarmService.class);
                stopService.setAction(KitchenAlarmService.ACTION_STOP);
                stopService.putExtra(KitchenAlarmService.EXTRA_ALARM_ID, alarmId);
                context.startService(stopService);
            } catch (Exception ignored) {
            }
            KitchenAlarmPlugin.notifyAlarmStopped(alarmId);
            return;
        }

        if (KitchenAlarmService.ACTION_SNOOZE.equals(action)) {
            KitchenAlarmService.clearRingingPrefs(context);
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.cancel(KitchenAlarmService.NOTIFICATION_ID);
            }
            try {
                Intent stopService = new Intent(context, KitchenAlarmService.class);
                stopService.setAction(KitchenAlarmService.ACTION_STOP);
                stopService.putExtra(KitchenAlarmService.EXTRA_ALARM_ID, alarmId);
                context.startService(stopService);
            } catch (Exception ignored) {
            }

            long nextTriggerMs = System.currentTimeMillis() + 120_000L;
            scheduleExact(context, alarmId, nextTriggerMs, title, body);
            KitchenAlarmPlugin.notifyAlarmSnoozed(alarmId, nextTriggerMs);
            return;
        }

        KitchenAlarmService.saveRingingPrefs(context, alarmId, title, body);
        KitchenAlarmService.ensureChannel(context);
        Notification immediate = KitchenAlarmService.buildAlarmNotification(context, alarmId, title, body);
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) {
            try {
                nm.notify(KitchenAlarmService.NOTIFICATION_ID, immediate);
            } catch (SecurityException ignored) {
            }
        }
        KitchenAlarmPlugin.notifyAlarmRinging(alarmId, title, body);

        Intent serviceIntent = new Intent(context, KitchenAlarmService.class);
        serviceIntent.setAction(KitchenAlarmService.ACTION_START);
        serviceIntent.putExtra(KitchenAlarmService.EXTRA_ALARM_ID, alarmId);
        serviceIntent.putExtra(KitchenAlarmService.EXTRA_TITLE, title);
        serviceIntent.putExtra(KitchenAlarmService.EXTRA_BODY, body);

        try {
            ContextCompat.startForegroundService(context, serviceIntent);
        } catch (Exception e) {
            try {
                Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                Ringtone r = RingtoneManager.getRingtone(context, uri);
                if (r != null) r.play();
            } catch (Exception ignored) {
            }
        }
    }

    public static void scheduleExact(
        Context context,
        String alarmId,
        long triggerAtMs,
        String title,
        String body
    ) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        Intent fireIntent = new Intent(context, KitchenAlarmReceiver.class);
        fireIntent.setAction(KitchenAlarmService.ACTION_START);
        fireIntent.putExtra(KitchenAlarmService.EXTRA_ALARM_ID, alarmId);
        fireIntent.putExtra(KitchenAlarmService.EXTRA_TITLE, title);
        fireIntent.putExtra(KitchenAlarmService.EXTRA_BODY, body);

        int requestCode = alarmId.hashCode();
        PendingIntent firePending = PendingIntent.getBroadcast(
            context,
            requestCode,
            fireIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent showPending = PendingIntent.getActivity(
            context,
            requestCode + 1,
            showIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            alarmManager.setAlarmClock(
                new AlarmManager.AlarmClockInfo(triggerAtMs, showPending),
                firePending
            );
        } catch (SecurityException e) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, firePending);
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, firePending);
                }
            } catch (SecurityException ignored) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, firePending);
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, firePending);
                }
            }
        }
    }

    public static void cancelExact(Context context, String alarmId) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null || alarmId == null) return;
        Intent fireIntent = new Intent(context, KitchenAlarmReceiver.class);
        fireIntent.setAction(KitchenAlarmService.ACTION_START);
        PendingIntent firePending = PendingIntent.getBroadcast(
            context,
            alarmId.hashCode(),
            fireIntent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (firePending != null) {
            alarmManager.cancel(firePending);
            firePending.cancel();
        }
    }
}
