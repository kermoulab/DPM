package com.vectis.erp.core.design

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val LocalLogoutHandler = staticCompositionLocalOf<() -> Unit> { {} }

/**
 * VectisTopAppBar - Global top nav bar:
 * - Left side: Search icon alone
 * - Right side: Notifications icon + Profile icon with dropdown menu:
 *   1. Active user name, below it their role (admin/owner in green, agent in orange)
 *   2. Settings icon and text (navigates to Settings view)
 *   3. Log out icon and text (in red)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VectisTopAppBar(
    onNavigateToSettings: () -> Unit = {},
    onNavigateToAlerts: () -> Unit = {},
    onOpenSearch: () -> Unit = {},
    onLogout: (() -> Unit)? = null,
    alertCount: Int = 0,
    userName: String? = null,
    userRole: String? = null,
    onRefresh: () -> Unit = {},
    preferredCurrency: String = "USD"
) {
    val contextLogout = LocalLogoutHandler.current
    val performLogout = onLogout ?: contextLogout
    var showProfileMenu by remember { mutableStateOf(false) }

    val resolvedUserName = remember(userName, showProfileMenu) {
        if (!userName.isNullOrBlank()) userName
        else {
            try {
                com.vectis.erp.VectisApplication.instance.secureStorage.getUserName() ?: "Admin"
            } catch (_: Exception) {
                "Admin"
            }
        }
    }

    val userInitials = remember(resolvedUserName) {
        getUserInitials(resolvedUserName)
    }

    val resolvedUserRole = remember(userRole, showProfileMenu) {
        if (!userRole.isNullOrBlank()) userRole
        else {
            try {
                com.vectis.erp.VectisApplication.instance.secureStorage.getUserRole() ?: "admin"
            } catch (_: Exception) {
                "admin"
            }
        }
    }

    val (roleColor, roleDisplay) = remember(resolvedUserRole) {
        getUserRoleBadgeConfig(resolvedUserRole)
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .height(54.dp)
                .padding(horizontal = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left side: Search icon alone
            IconButton(
                onClick = onOpenSearch,
                modifier = Modifier.size(38.dp)
            ) {
                Icon(
                    Icons.Default.Search,
                    contentDescription = "Search",
                    tint = Slate700,
                    modifier = Modifier.size(20.dp)
                )
            }

            // Right side: Notifications icon + Profile icon with dropdown
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Notifications icon (near profile icon on left)
                IconButton(
                    onClick = onNavigateToAlerts,
                    modifier = Modifier.size(38.dp)
                ) {
                    if (alertCount > 0) {
                        BadgedBox(
                            badge = {
                                Badge(
                                    containerColor = StatusDanger,
                                    contentColor = Color.White
                                ) {
                                    Text(
                                        text = if (alertCount > 99) "99+" else "$alertCount",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        ) {
                            Icon(
                                Icons.Default.Notifications,
                                contentDescription = "Alerts",
                                tint = PrimaryBlue,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    } else {
                        Icon(
                            Icons.Default.Notifications,
                            contentDescription = "Alerts",
                            tint = Slate600,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Profile avatar with dropdown menu
                Box {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(PrimaryBlue.copy(alpha = 0.12f))
                            .border(1.dp, PrimaryBlue.copy(alpha = 0.25f), CircleShape)
                            .clickable(onClickLabel = "Profile") { showProfileMenu = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = userInitials,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryBlue
                        )
                    }

                    DropdownMenu(
                        expanded = showProfileMenu,
                        onDismissRequest = { showProfileMenu = false },
                        modifier = Modifier
                            .widthIn(min = 190.dp, max = 250.dp)
                            .background(Color.White)
                    ) {
                        // 1. Active user name below it their role
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 12.dp)
                        ) {
                            Text(
                                text = resolvedUserName,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Slate900,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = roleDisplay,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = roleColor
                            )
                        }

                        HorizontalDivider(color = Slate100, thickness = 1.dp)

                        // 2. Settings icon and text (on click takes you to settings view)
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = "Settings",
                                    fontSize = 14.sp,
                                    color = Slate800,
                                    fontWeight = FontWeight.Medium
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.Settings,
                                    contentDescription = "Settings",
                                    tint = Slate700,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            onClick = {
                                showProfileMenu = false
                                onNavigateToSettings()
                            }
                        )

                        // 3. Log out icon and text (in red)
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = "Log out",
                                    fontSize = 14.sp,
                                    color = StatusDanger,
                                    fontWeight = FontWeight.Medium
                                )
                            },
                            leadingIcon = {
                                Icon(
                                    Icons.AutoMirrored.Filled.ExitToApp,
                                    contentDescription = "Log out",
                                    tint = StatusDanger,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            onClick = {
                                showProfileMenu = false
                                performLogout()
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Returns the color and display label for a user's role:
 * - Admin/Owner: Green (#16A34A)
 * - Agent: Orange (#EA580C)
 */
fun getUserRoleBadgeConfig(role: String?): Pair<Color, String> {
    val roleNormalized = role?.lowercase()?.trim() ?: "admin"
    val isAgent = roleNormalized == "agent"
    val color = if (isAgent) Color(0xFFEA580C) else Color(0xFF16A34A)
    val label = when (roleNormalized) {
        "admin" -> "Admin"
        "owner" -> "Owner"
        "agent" -> "Agent"
        "manager" -> "Manager"
        "viewer" -> "Viewer"
        else -> roleNormalized.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
    return Pair(color, label)
}

/**
 * ViewHeader - Standard section directly beneath the top bar for each view:
 * Left: View name/title and description.
 * Right: View-specific action icons.
 */
@Composable
fun ViewHeader(
    title: String,
    description: String? = null,
    modifier: Modifier = Modifier,
    actions: (@Composable RowScope.() -> Unit)? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 16.dp, end = 12.dp, top = 12.dp, bottom = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f, fill = false)) {
            Text(
                text = title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Slate900
            )
            if (!description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = description,
                    fontSize = 12.sp,
                    color = Slate500
                )
            }
        }
        if (actions != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                actions()
            }
        }
    }
}

/**
 * Extracts 2 capital letters representing the active user:
 * - First letter from first name and first letter from last name (e.g. "John Doe" -> "JD")
 * - If single-word name, the first two characters in uppercase (e.g. "Admin" -> "AD")
 * - Fallbacks to "AD" for empty or blank input
 */
fun getUserInitials(name: String?): String {
    if (name.isNullOrBlank()) return "AD"
    val tokens = name.trim().split("[\\s._-]+".toRegex()).filter { it.isNotBlank() }
    return when {
        tokens.size >= 2 -> {
            val first = tokens.first().firstOrNull()?.uppercaseChar() ?: 'A'
            val last = tokens.last().firstOrNull()?.uppercaseChar() ?: 'D'
            "$first$last"
        }
        tokens.size == 1 -> {
            val single = tokens[0]
            if (single.length >= 2) {
                single.take(2).uppercase()
            } else {
                "${single.uppercase()}U"
            }
        }
        else -> "AD"
    }
}

