package lk.udenisspecials.bakery;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import androidx.core.app.NotificationCompat;

public class KitchenAlarmService extends Service {
    public static final String CHANNEL_ID = "kitchen_step_alarm_channel";
    public static final int NOTIFICATION_ID = 42001;
    public static final String PREFS_NAME = "kitchen_alarm_prefs";
    public static final String KEY_RINGING_ID = "ringing_alarm_id";
    public static final String KEY_RINGING_TITLE = "ringing_title";
    public static final String KEY_RINGING_BODY = "ringing_body";

    public static final String ACTION_START = "lk.udenisspecials.bakery.ALARM_START";
    public static final String ACTION_STOP = "lk.udenisspecials.bakery.ALARM_STOP";
    public static final String ACTION_SNOOZE = "lk.udenisspecials.bakery.ALARM_SNOOZE";

    public static final String EXTRA_ALARM_ID = "alarmId";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";

    private MediaPlayer mediaPlayer;
    private Ringtone fallbackRingtone;
    private Vibrator vibrator;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopAlarmPlayback();
            clearRingingPrefs(this);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.cancel(NOTIFICATION_ID);
            }
            KitchenAlarmPlugin.notifyAlarmStopped(intent.getStringExtra(EXTRA_ALARM_ID));
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }

        String alarmId = intent.getStringExtra(EXTRA_ALARM_ID);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        if (alarmId == null || alarmId.isEmpty()) {
            alarmId = "kitchen-timer";
        }
        if (title == null || title.isEmpty()) {
            title = "Kitchen Timer";
        }
        if (body == null || body.isEmpty()) {
            body = "Step timer is up!";
        }

        saveRingingPrefs(this, alarmId, title, body);
        ensureChannel(this);

        Notification notification = buildAlarmNotification(this, alarmId, title, body);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                );
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                try {
                    nm.notify(NOTIFICATION_ID, notification);
                } catch (SecurityException ignored) {
                }
            }
        }

        startAlarmPlayback();
        KitchenAlarmPlugin.notifyAlarmRinging(alarmId, title, body);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopAlarmPlayback();
        super.onDestroy();
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Kitchen Step Alarms",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Rings when a Cook Mode step timer finishes");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.setBypassDnd(true);
        channel.setSound(null, null);
        manager.createNotificationChannel(channel);
    }

    public static Notification buildAlarmNotification(
        Context context,
        String alarmId,
        String title,
        String body
    ) {
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra(EXTRA_ALARM_ID, alarmId);
        PendingIntent openPending = PendingIntent.getActivity(
            context,
            101,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(context, KitchenAlarmReceiver.class);
        stopIntent.setAction(ACTION_STOP);
        stopIntent.putExtra(EXTRA_ALARM_ID, alarmId);
        PendingIntent stopPending = PendingIntent.getBroadcast(
            context,
            102,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent snoozeIntent = new Intent(context, KitchenAlarmReceiver.class);
        snoozeIntent.setAction(ACTION_SNOOZE);
        snoozeIntent.putExtra(EXTRA_ALARM_ID, alarmId);
        snoozeIntent.putExtra(EXTRA_TITLE, title);
        snoozeIntent.putExtra(EXTRA_BODY, body);
        PendingIntent snoozePending = PendingIntent.getBroadcast(
            context,
            103,
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Bitmap largeIcon = BitmapFactory.decodeResource(
            context.getResources(),
            R.mipmap.ic_launcher_round
        );

        return new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_bakery)
            .setColor(0xFF9F1239)
            .setLargeIcon(largeIcon)
            .setContentTitle(title)
            .setContentText(body)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(openPending)
            .setFullScreenIntent(openPending, true)
            .addAction(0, "Turn off", stopPending)
            .addAction(0, "+2 min", snoozePending)
            .build();
    }

    private void startAlarmPlayback() {
        stopAlarmPlayback();
        Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmUri == null) {
            alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        }
        if (alarmUri == null) {
            alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        boolean mediaPlaying = false;
        if (alarmUri != null) {
            try {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(this, alarmUri);
                mediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
                mediaPlayer.setLooping(true);
                mediaPlayer.prepare();
                mediaPlayer.start();
                mediaPlaying = true;
            } catch (Exception ignored) {
                mediaPlayer = null;
            }
        }

        if (!mediaPlaying && alarmUri != null) {
            try {
                fallbackRingtone = RingtoneManager.getRingtone(this, alarmUri);
                if (fallbackRingtone != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        fallbackRingtone.setLooping(true);
                    }
                    fallbackRingtone.play();
                }
            } catch (Exception ignored) {
                fallbackRingtone = null;
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                if (vm != null) vibrator = vm.getDefaultVibrator();
            } else {
                vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[] { 0, 600, 400 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
                } else {
                    vibrator.vibrate(pattern, 0);
                }
            }
        } catch (Exception ignored) {
            vibrator = null;
        }
    }

    private void stopAlarmPlayback() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (Exception ignored) {
            }
            try {
                mediaPlayer.release();
            } catch (Exception ignored) {
            }
            mediaPlayer = null;
        }
        if (fallbackRingtone != null) {
            try {
                if (fallbackRingtone.isPlaying()) {
                    fallbackRingtone.stop();
                }
            } catch (Exception ignored) {
            }
            fallbackRingtone = null;
        }
        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {
            }
            vibrator = null;
        }
    }

    public static void saveRingingPrefs(Context context, String alarmId, String title, String body) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_RINGING_ID, alarmId)
            .putString(KEY_RINGING_TITLE, title)
            .putString(KEY_RINGING_BODY, body)
            .apply();
    }

    public static void clearRingingPrefs(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .remove(KEY_RINGING_ID)
            .remove(KEY_RINGING_TITLE)
            .remove(KEY_RINGING_BODY)
            .apply();
    }
}
