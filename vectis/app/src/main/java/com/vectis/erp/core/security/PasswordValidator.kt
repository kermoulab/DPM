package com.vectis.erp.core.security

object PasswordValidator {
    /**
     * Enforces strong password requirements:
     * - Minimum 8 characters
     * - At least one uppercase letter (A-Z)
     * - At least one number (0-9)
     * - At least one special symbol (e.g. !@#$%^&*()_+-=[]{};':",.<>/?)
     *
     * Returns null if valid, or a user-facing error message describing missing requirements.
     */
    fun validate(password: String): String? {
        if (password.length < 8) {
            return "Password must be at least 8 characters long."
        }
        if (!password.any { it.isUpperCase() }) {
            return "Password must include at least one capital letter (A-Z)."
        }
        if (!password.any { it.isDigit() }) {
            return "Password must include at least one number (0-9)."
        }
        if (!password.any { !it.isLetterOrDigit() }) {
            return "Password must include at least one symbol (e.g. !@#$%^&*)."
        }
        return null
    }

    fun isStrong(password: String): Boolean = validate(password) == null
}
