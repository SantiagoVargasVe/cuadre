/**
 * Spanish message catalog. Imported directly rather than looked up by a
 * runtime string key — `es.auth.login.title` is a compile-time-checked
 * property access, so a typo is a build error instead of a blank label in
 * production. Retrofitting a second locale means adding a sibling file
 * with the same shape plus a lookup by the active locale; nothing here
 * blocks that.
 */
export const es = {
  auth: {
    login: {
      title: "Iniciar sesión",
      emailLabel: "Correo electrónico",
      passwordLabel: "Contraseña",
      submit: "Iniciar sesión",
      submitting: "Iniciando sesión…",
      noAccount: "¿No tienes cuenta?",
      registerLink: "Regístrate",
      errors: {
        INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
        RATE_LIMITED: "Demasiados intentos. Intenta de nuevo más tarde.",
        ORIGIN_NOT_ALLOWED: "No se pudo verificar la solicitud. Recarga la página.",
        generic: "Ocurrió un error. Intenta de nuevo.",
      },
    },
    register: {
      title: "Crear cuenta",
      emailLabel: "Correo electrónico",
      displayNameLabel: "Nombre",
      passwordLabel: "Contraseña",
      passwordHint: "Mínimo 8 caracteres.",
      inviteCodeLabel: "Código de invitación",
      submit: "Crear cuenta",
      submitting: "Creando cuenta…",
      hasAccount: "¿Ya tienes cuenta?",
      loginLink: "Inicia sesión",
      errors: {
        INVALID_INVITE_CODE: "El código de invitación no es válido o ya fue usado.",
        EMAIL_ALREADY_REGISTERED: "Ese correo ya está registrado.",
        RATE_LIMITED: "Demasiados intentos. Intenta de nuevo más tarde.",
        ORIGIN_NOT_ALLOWED: "No se pudo verificar la solicitud. Recarga la página.",
        generic: "Ocurrió un error. Intenta de nuevo.",
      },
    },
    validation: {
      emailInvalid: "Correo electrónico inválido.",
      passwordTooShort: "La contraseña debe tener al menos 8 caracteres.",
      displayNameRequired: "El nombre es obligatorio.",
      inviteCodeRequired: "El código de invitación es obligatorio.",
    },
  },
} as const;
