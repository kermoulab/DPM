package com.vectis.erp

import com.google.gson.Gson
import com.vectis.erp.core.notification.NotificationHelper
import com.vectis.erp.data.model.*
import org.junit.Assert.*
import org.junit.Test

class PushNotificationModelsAndDeduplicationTest {

    private val gson = Gson()

    @Test
    fun testRegisterPushTokenRequestSerialization() {
        val req = RegisterPushTokenRequest(
            token = "fcm_test_device_token_xyz_123",
            deviceId = "dev-abc12345",
            platform = "android",
            appVersion = "1.0.0"
        )

        val json = gson.toJson(req)
        assertTrue(json.contains("\"token\":\"fcm_test_device_token_xyz_123\""))
        assertTrue(json.contains("\"device_id\":\"dev-abc12345\""))
        assertTrue(json.contains("\"platform\":\"android\""))

        val deserialized = gson.fromJson(json, RegisterPushTokenRequest::class.java)
        assertEquals("fcm_test_device_token_xyz_123", deserialized.token)
        assertEquals("dev-abc12345", deserialized.deviceId)
        assertEquals("android", deserialized.platform)
    }

    @Test
    fun testNotificationsListResponseParsing() {
        val rawJson = """
            {
              "success": true,
              "unreadCount": 2,
              "notifications": [
                {
                  "id": "notif-1",
                  "user_id": "usr-1",
                  "type": "ORDER_EXPIRING",
                  "title": "Subscription Expiring Soon",
                  "message": "Order #ORD-1001 expires in 3 days",
                  "entity_type": "order",
                  "entity_id": "ord-1001",
                  "dedup_key": "order:ord-1001:3d",
                  "is_read": false,
                  "created_at": "2026-09-28T18:00:00Z",
                  "sent_at": "2026-09-28T18:00:01Z"
                },
                {
                  "id": "notif-2",
                  "user_id": "usr-1",
                  "type": "PASSWORD_CHANGED",
                  "title": "Security Alert: Password Changed",
                  "message": "Your Vectis account password was changed.",
                  "entity_type": "user",
                  "entity_id": "usr-1",
                  "dedup_key": null,
                  "is_read": true,
                  "created_at": "2026-09-28T17:30:00Z",
                  "sent_at": "2026-09-28T17:30:00Z"
                }
              ]
            }
        """.trimIndent()

        val parsed = gson.fromJson(rawJson, NotificationsListResponse::class.java)
        assertTrue(parsed.success)
        assertEquals(2, parsed.unreadCount)
        assertEquals(2, parsed.notifications.size)

        val first = parsed.notifications[0]
        assertEquals("ORDER_EXPIRING", first.type)
        assertEquals("order:ord-1001:3d", first.dedupKey)
        assertFalse(first.isRead)

        val second = parsed.notifications[1]
        assertEquals("PASSWORD_CHANGED", second.type)
        assertTrue(second.isRead)
    }

    @Test
    fun testNotificationChannelConstant() {
        assertEquals("vectis_subscription_alerts", NotificationHelper.CHANNEL_ID_ALERTS)
    }
}
