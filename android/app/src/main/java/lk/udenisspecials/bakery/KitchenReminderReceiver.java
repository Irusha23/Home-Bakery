package lk.udenisspecials.bakery;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

public class KitchenReminderReceiver extends BroadcastReceiver {
    public static final String PREFS_NAME = "kitchen_reminder_prefs";
    public static final String KEY_POSTED_IDS = "posted_reminder_ids";
    public static final String KEY_PENDING_EVENTS = "pending_reminder_events";

    public static final String ACTION_REMINDER_READ = "lk.udenisspecials.bakery.REMINDER_READ";
    public static final String ACTION_REMINDER_CLEAR = "lk.udenisspecials.bakery.REMINDER_CLEAR";
    public static final String ACTION_REMINDER_CLEAR_ALL = "lk.udenisspecials.bakery.REMINDER_CLEAR_ALL";

    public static final String EXTRA_REMINDER_ID = "reminderId";
    public static final String EXTRA_TARGET_TAB = "targetTab";
    public static final String EXTRA_ORDER_ID = "orderId";
    public static final String EXTRA_STARTER_ACTION = "starterAction";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        NotificationManager nm = context.getSystemService(NotificationManager.class);

        if (ACTION_REMINDER_CLEAR_ALL.equals(action)) {
            Set<String> posted = getPostedIds(context);
            if (nm != null) {
                for (String id : posted) {
                    nm.cancel(KitchenAlarmPlugin.reminderNotifId(id));
                }
                nm.cancel(KitchenAlarmPlugin.REMINDER_SUMMARY_ID);
            }
            JSONArray idsArray = new JSONArray();
            for (String id : posted) {
                idsArray.put(id);
            }
            savePostedIds(context, new HashSet<>());
            recordAndDispatchEvent(context, "clear-all", null, idsArray, null, null, null);
            return;
        }

        String reminderId = intent.getStringExtra(EXTRA_REMINDER_ID);
        if (reminderId == null || reminderId.isEmpty()) return;

        if (nm != null) {
            nm.cancel(KitchenAlarmPlugin.reminderNotifId(reminderId));
        }

        Set<String> posted = new HashSet<>(getPostedIds(context));
        posted.remove(reminderId);
        savePostedIds(context, posted);

        if (nm != null && posted.size() < 2) {
            nm.cancel(KitchenAlarmPlugin.REMINDER_SUMMARY_ID);
        }

        if (ACTION_REMINDER_READ.equals(action)) {
            recordAndDispatchEvent(context, "read", reminderId, null, null, null, null);
        } else if (ACTION_REMINDER_CLEAR.equals(action)) {
            recordAndDispatchEvent(context, "clear", reminderId, null, null, null, null);
        }
    }

    public static Set<String> getPostedIds(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getStringSet(KEY_POSTED_IDS, new HashSet<>());
    }

    public static void savePostedIds(Context context, Set<String> ids) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putStringSet(KEY_POSTED_IDS, new HashSet<>(ids)).apply();
    }

    public static void recordAndDispatchEvent(
        Context context,
        String action,
        String reminderId,
        JSONArray ids,
        String orderId,
        String targetTab,
        String starterAction
    ) {
        try {
            JSONObject evt = new JSONObject();
            evt.put("action", action);
            if (reminderId != null) evt.put("id", reminderId);
            if (ids != null) evt.put("ids", ids);
            if (orderId != null) evt.put("orderId", orderId);
            if (targetTab != null) evt.put("targetTab", targetTab);
            if (starterAction != null) evt.put("starterAction", starterAction);

            if (KitchenAlarmPlugin.notifyReminderEventIfActive(evt)) {
                return;
            }

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingRaw = prefs.getString(KEY_PENDING_EVENTS, "[]");
            JSONArray queue = new JSONArray(existingRaw);
            queue.put(evt);
            prefs.edit().putString(KEY_PENDING_EVENTS, queue.toString()).apply();
        } catch (Exception ignored) {
        }
    }
}
