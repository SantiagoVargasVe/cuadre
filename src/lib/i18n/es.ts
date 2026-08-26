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
  nav: {
    appName: "Cuadre",
    groupsLink: "Grupos",
    logout: "Cerrar sesión",
    loggingOut: "Cerrando sesión…",
    themeToLight: "Cambiar a tema claro",
    themeToDark: "Cambiar a tema oscuro",
  },
  groupTabs: {
    expenses: "Gastos",
    balances: "Balances",
    settings: "Ajustes",
  },
  money: {
    convertedMarkerLabel: "Monto convertido",
    convertedFrom: (original: string, date: string) => `Convertido de ${original} el ${date}`,
  },
  common: {
    loading: "Cargando…",
    genericError: "Ocurrió un error. Intenta de nuevo.",
    comingSoon: "Próximamente.",
  },
  groups: {
    heading: "Tus grupos",
    createButton: "Crear grupo",
    memberCount: (n: number) => (n === 1 ? "1 miembro" : `${n} miembros`),
    settled: "En ceros",
    archivedSectionTitle: "Archivados",
    empty: {
      title: "Aún no tienes grupos",
      body: "Crea uno para empezar a llevar la cuenta, o pide que te compartan un enlace de invitación a uno ya existente.",
    },
    createDialog: {
      title: "Crear grupo",
      titleLabel: "Título",
      descriptionLabel: "Descripción",
      descriptionHint: "Opcional.",
      currencyLabel: "Moneda por defecto",
      submit: "Crear",
      submitting: "Creando…",
      cancel: "Cancelar",
      errors: {
        generic: "Ocurrió un error. Intenta de nuevo.",
      },
    },
  },
  join: {
    someone: "Alguien",
    invitedToGroup: (inviter: string, group: string) => `${inviter} te invitó a ${group}`,
    invitedGeneric: (inviter: string) => `${inviter} te invitó a Cuadre`,
    invalidTitle: "Invitación no válida",
    invalidBody: "Este enlace de invitación ya no es válido o expiró.",
    loginLink: "Iniciar sesión",
    joinButton: "Unirme al grupo",
    joining: "Uniéndote…",
    errors: {
      ALREADY_A_MEMBER: "Ya eres miembro de este grupo.",
      generic: "Ocurrió un error. Intenta de nuevo.",
    },
  },
} as const;
