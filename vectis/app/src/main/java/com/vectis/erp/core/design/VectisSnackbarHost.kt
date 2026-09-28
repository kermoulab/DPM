package com.vectis.erp.core.design

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Strips raw JSON wrapper artifacts from error or success messages, e.g.:
 * - `{"error": "Invalid plan"}` -> `Invalid plan`
 * - `{"error ": "xxxxxx"}` -> `xxxxxx`
 * - `{"message": "Order cancelled"}` -> `Order cancelled`
 * - `Failed: {"error": "Out of stock"}` -> `Out of stock`
 */
fun cleanUserFacingMessage(message: String): String {
    val trimmed = message.trim()
    if (trimmed.isEmpty()) return ""

    val jsonStart = trimmed.indexOf('{')
    val jsonEnd = trimmed.lastIndexOf('}')

    if (jsonStart != -1 && jsonEnd != -1 && jsonEnd > jsonStart) {
        val prefix = trimmed.substring(0, jsonStart).trim()
        val jsonSubstring = trimmed.substring(jsonStart, jsonEnd + 1)
        val extracted = extractMessageFromJson(jsonSubstring)
        if (!extracted.isNullOrBlank()) {
            return if (prefix.isNotBlank() && !prefix.startsWith("Failed:", ignoreCase = true) && !prefix.startsWith("Error:", ignoreCase = true)) {
                "$prefix $extracted"
            } else {
                extracted
            }
        }
    }

    // Regex fallback for malformed JSON or variants with spaces in keys like `{"error ": "xxxxxx"}`
    val regex = Regex("""["']?(?:error\s*|message\s*|detail\s*|msg\s*|err\s*)["']?\s*:\s*["']([^"']+)["']""", RegexOption.IGNORE_CASE)
    val match = regex.find(trimmed)
    if (match != null && match.groupValues.size > 1) {
        val candidate = match.groupValues[1].trim()
        if (candidate.isNotEmpty() && !candidate.startsWith("{")) {
            return candidate
        }
    }

    return trimmed
}

private fun extractMessageFromJson(jsonString: String): String? {
    return try {
        val json = org.json.JSONObject(jsonString)
        val priorityKeys = listOf("error", "message", "detail", "msg", "err", "description", "title")
        for (targetKey in priorityKeys) {
            val iterator = json.keys()
            while (iterator.hasNext()) {
                val key = iterator.next()
                if (key.trim().equals(targetKey, ignoreCase = true)) {
                    val value = json.opt(key)
                    if (value is String && value.isNotBlank()) {
                        return cleanUserFacingMessage(value.trim())
                    } else if (value is org.json.JSONObject) {
                        return extractMessageFromJson(value.toString())
                    } else if (value != null && value != org.json.JSONObject.NULL) {
                        val s = value.toString().trim()
                        if (s.isNotBlank() && s != "null") return s
                    }
                }
            }
        }
        null
    } catch (_: Exception) {
        null
    }
}

/**
 * Determines whether a snackbar message indicates an error.
 */
fun isErrorMessage(message: String): Boolean {
    val clean = cleanUserFacingMessage(message)
    val lower = clean.lowercase().trim()
    val isExplicitSuccess = isSuccessMessage(clean)
    val isExplicitError = lower.startsWith("failed") ||
            lower.startsWith("error") ||
            lower.contains("failed") ||
            lower.contains("error") ||
            lower.contains("unable") ||
            lower.contains("cannot") ||
            lower.contains("invalid") ||
            lower.contains("denied") ||
            lower.contains("exception") ||
            lower.contains("refused") ||
            lower.contains("timeout") ||
            lower.contains("unauthorized") ||
            lower.contains("not found") ||
            lower.contains("forbidden") ||
            lower.contains("required") ||
            lower.contains("missing") ||
            lower.contains("incorrect") ||
            lower.contains("wrong") ||
            lower.contains("conflict") ||
            lower.contains("exhausted") ||
            lower.contains("bad request")

    return isExplicitError || (!isExplicitSuccess && (lower.contains("fail") || lower.contains("err")))
}

/**
 * Determines whether a snackbar message indicates a success.
 */
fun isSuccessMessage(message: String): Boolean {
    val clean = cleanUserFacingMessage(message)
    val lower = clean.lowercase().trim()
    // If it clearly starts with an error keyword, it's not a success
    if (lower.startsWith("failed") || lower.startsWith("error") || lower.contains("failed to")) {
        return false
    }
    return lower.startsWith("success") ||
            lower.endsWith("successfully") ||
            lower.contains("successfully") ||
            lower.contains("success") ||
            lower.contains("created") ||
            lower.contains("saved") ||
            lower.contains("updated") ||
            lower.contains("deleted") ||
            lower.contains("removed") ||
            lower.contains("imported") ||
            lower.contains("copied") ||
            lower.contains("opened") ||
            lower.contains("released") ||
            lower.contains("cancelled") ||
            lower.contains("reactivated") ||
            lower.contains("renewed") ||
            lower.contains("unlinked") ||
            lower.contains("unpaired")
}

/**
 * Resolves the background container color for a popup/snackbar based on message classification.
 * - Error: StatusDanger (#EF4444)
 * - Success: StatusSuccess (#16A34A)
 * - Other/Neutral: Slate800 (#1E293B)
 */
fun getSnackbarContainerColor(message: String): Color {
    val clean = cleanUserFacingMessage(message)
    val isErr = isErrorMessage(clean)
    val isSucc = isSuccessMessage(clean)
    return when {
        isErr -> StatusDanger
        isSucc -> StatusSuccess
        else -> Slate800
    }
}

/**
 * VectisSnackbarHost:
 * Displays floating messages aligned in the center, with background pill width
 * adapted to the error or success text rather than filling the entire screen width.
 * - Error: StatusDanger (#EF4444)
 * - Success: StatusSuccess (#16A34A)
 * - Other/Neutral: Slate800 (#1E293B)
 */
@Composable
fun VectisSnackbarHost(
    hostState: SnackbarHostState,
    modifier: Modifier = Modifier
) {
    SnackbarHost(
        hostState = hostState,
        modifier = modifier
            .fillMaxWidth()
            .wrapContentWidth(Alignment.CenterHorizontally)
            .padding(bottom = 76.dp, start = 24.dp, end = 24.dp)
    ) { data ->
        val displayMessage = cleanUserFacingMessage(data.visuals.message)
        val isErr = isErrorMessage(displayMessage)
        val isSucc = isSuccessMessage(displayMessage)
        val containerColor = getSnackbarContainerColor(displayMessage)

        Surface(
            modifier = Modifier.wrapContentSize(Alignment.Center),
            shape = RoundedCornerShape(24.dp),
            color = containerColor,
            shadowElevation = 6.dp,
            tonalElevation = 2.dp
        ) {
            Row(
                modifier = Modifier
                    .padding(horizontal = 18.dp, vertical = 10.dp)
                    .wrapContentWidth(Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                if (isSucc) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Success",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                } else if (isErr) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = "Error",
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }

                Text(
                    text = displayMessage,
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center
                )

                if (data.visuals.actionLabel != null) {
                    Spacer(modifier = Modifier.width(8.dp))
                    TextButton(
                        onClick = { data.performAction() },
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = data.visuals.actionLabel!!,
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                }
                if (data.visuals.withDismissAction) {
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = { data.dismiss() },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = "Dismiss",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}
