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
    account: "Tu cuenta",
    logout: "Cerrar sesión",
    loggingOut: "Cerrando sesión…",
    themeToLight: "Cambiar a tema claro",
    themeToDark: "Cambiar a tema oscuro",
  },
  account: {
    heading: "Tu cuenta",
    subheading: "Ajustes personales. Valen para todos tus grupos, no para uno solo.",
    profile: {
      heading: "Perfil",
      body: "Tu nombre es el que ven los demás en la lista de miembros, en quién pagó cada gasto y en los pagos registrados.",
      nameLabel: "Nombre",
      save: "Guardar",
      saving: "Guardando…",
      saved: "Nombre actualizado.",
      error: "No se pudo guardar el nombre. Intenta de nuevo.",
    },
    security: {
      heading: "Seguridad",
      body: "Cambiar la contraseña o el correo todavía no está disponible.",
      changePassword: "Cambiar contraseña",
    },
    avatar: {
      heading: "Tu avatar",
      body: "Se genera a partir de un estilo, unos colores y una semilla — sin subir imágenes. Lo verán los demás miembros de tus grupos.",
      previewSmall: "Como se ve en una fila:",
      reroll: "Otra",
      save: "Guardar",
      saving: "Guardando…",
      useDefault: "Usar el predeterminado",
      error: "No se pudo guardar el avatar. Intenta de nuevo.",
      palette: {
        default: "Mezcla",
        cool: "Fríos",
        warm: "Cálidos",
      },
      variantName: {
        marble: "Mármol",
        beam: "Caritas",
        pixel: "Píxeles",
        sunset: "Atardecer",
        ring: "Anillos",
        bauhaus: "Bauhaus",
      },
      variantLabel: (v: string) => `Elegir el estilo ${v}`,
    },
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
  splitEditor: {
    summaryEqual: "Dividido: entre todos",
    summaryEqualSubset: (n: number) => `Dividido: entre ${n} personas`,
    summaryShares: "Dividido: por partes",
    summaryPercentage: "Dividido: por porcentaje",
    summaryExact: "Dividido: por montos exactos",
    summaryLoan: (name: string) => `Préstamo a ${name}`,
    strategyLabel: "¿Cómo se divide?",
    strategies: {
      equal: "Igual",
      shares: "Por partes",
      percentage: "Porcentaje",
      exact: "Monto exacto",
      loan: "Préstamo",
    },
    remainderOwed: (formatted: string) => `Faltan ${formatted}`,
    remainderExtra: (formatted: string) => `Sobran ${formatted}`,
    remainderBalanced: "Balanceado",
    percentageOwed: (pct: string) => `Falta ${pct}%`,
    percentageExtra: (pct: string) => `Sobra ${pct}%`,
    selectAtLeastOne: "Selecciona al menos un miembro.",
    beneficiaryLabel: "¿Para quién es el préstamo?",
    sharesLabel: "partes",
  },
  expenseForm: {
    titleLabel: "Título",
    amountLabel: "Monto",
    dateLabel: "Fecha",
    currencyLabel: "Moneda",
    paidByYou: "Pagado por: tú",
    paidBySummary: (names: string[]) => `Pagado por: ${names.join(", ")}`,
    payersHeading: "¿Quién pagó?",
    remainderOwed: (formatted: string) => `Faltan ${formatted}`,
    remainderExtra: (formatted: string) => `Sobran ${formatted}`,
    remainderBalanced: "Balanceado",
    submit: "Guardar",
    submitting: "Guardando…",
    errors: {
      generic: "Ocurrió un error. Intenta de nuevo.",
    },
  },
  expenseFeed: {
    empty: {
      title: "Aún no hay gastos",
      body: "Agrega el primero para empezar a llevar la cuenta.",
    },
    addExpense: "Agregar gasto",
    loadMore: "Cargar más",
    loading: "Cargando…",
    export: "Exportar CSV",
    paidByYou: "Pagado por ti",
    paidBy: (name: string) => `Pagado por ${name}`,
    paidByMultiple: (n: number) => `Pagado por ${n} personas`,
    yourShare: "Tu parte",
    editedBy: (name: string, date: string) => `Editado por ${name} el ${date}`,
    editedUnknown: (date: string) => `Editado el ${date}`,
    detailTitle: "Detalle del gasto",
    payersHeading: "Pagado por",
    splitsHeading: "Dividido entre",
    /** How the expense was divided, in words — from `expense.strategy`, shown
     * in the detail dialog (T102). `equal` covers `equal_subset` too: the
     * split rows already name who, so "entre N personas" reads the same. */
    strategy: {
      equal: (n: number) => `En partes iguales entre ${n} ${n === 1 ? "persona" : "personas"}`,
      shares: "Por participaciones",
      percentage: "Por porcentaje",
      exact: "Montos exactos",
      loan: (name: string) => `Préstamo a ${name}`,
      unknown: "Dividido entre los participantes",
    },
    close: "Cerrar",
    comingSoon: {
      title: "Agregar gasto",
      body: "Próximamente.",
    },
  },
  expenseHistory: {
    heading: "Historial",
    loading: "Cargando historial…",
    error: "No se pudo cargar el historial. Intenta de nuevo.",
    unknownActor: "Alguien",
    unknownMember: "Miembro anterior",
    none: "sin monto",
    created: (actor: string, date: string) => `${actor} creó el gasto el ${date}`,
    updated: (actor: string, date: string) => `${actor} editó el gasto el ${date}`,
    deleted: (actor: string, date: string) => `${actor} eliminó el gasto el ${date}`,
    changed: (field: string) => `Cambió ${field}`,
    total: "el monto total",
    field: (field: "title" | "expenseDate" | "splitStrategy" | "currency") => {
      const labels = {
        title: "el título",
        expenseDate: "la fecha",
        splitStrategy: "la forma de dividir",
        currency: "la moneda",
      };
      return labels[field];
    },
    value: (field: "title" | "expenseDate" | "splitStrategy" | "currency", value: string) => {
      if (field !== "splitStrategy") return value;
      const strategy = {
        equal: "partes iguales",
        equal_subset: "partes iguales",
        shares: "participaciones",
        percentage: "porcentaje",
        exact: "montos exactos",
        loan: "préstamo",
      } as Record<string, string>;
      return strategy[value] ?? value;
    },
    party: (field: "payers" | "splits", change: "added" | "removed" | "changed", member: string) => {
      const subject = field === "payers" ? "quien pagó" : "la parte de";
      const verb = { added: "Agregó", removed: "Quitó", changed: "Cambió" }[change];
      return `${verb} ${subject} ${member}`;
    },
  },
  balances: {
    simplifyLabel: "Simplificar deudas",
    paidLabel: "Pagó",
    shareLabel: "Su parte",
    netIsOwed: (formatted: string) => `Le deben ${formatted}`,
    netOwes: (formatted: string) => `Debe ${formatted}`,
    netSettled: "En ceros",
    planHeading: "Plan de pago",
    youOwe: (name: string, formatted: string) => `Le debes a ${name} ${formatted}`,
    owesYou: (name: string, formatted: string) => `${name} te debe ${formatted}`,
    owesOther: (fromName: string, toName: string, formatted: string) =>
      `${fromName} le debe a ${toName} ${formatted}`,
    explainTitle: "¿Por qué este pago?",
    explainReplaces: "Esto reemplaza:",
    settledBlock: "Nadie debe nada en esta moneda.",
    zeroState: {
      title: "Todo en ceros",
      body: "No hay gastos todavía en este grupo.",
    },
    convertedMarkerLabel: "Tasas de conversión",
    pinLine: (from: string, to: string, date: string, source: string) =>
      `${from} → ${to}: tasa del ${date} (${source})`,
  },
  settings: {
    members: {
      heading: "Miembros",
      you: "(tú)",
      roleOwner: "Organizador",
      roleMember: "Miembro",
      joined: (date: string) => `se unió el ${date}`,
      remove: "Quitar",
      removing: "Quitando…",
      removeTitle: "Quitar del grupo",
      removeConfirm: (name: string) => `¿Quitar a ${name} del grupo? Sus gastos anteriores se conservan.`,
      cannotOwe: "No puedes salir debiendo. Saldos pendientes:",
      cancel: "Cancelar",
      close: "Entendido",
    },
    invite: {
      heading: "Invitar",
      body: "Comparte este enlace. Quien lo abra se une a este grupo (y crea su cuenta si aún no tiene).",
      mint: "Crear enlace de invitación",
      minting: "Creando…",
      linkLabel: "Enlace de invitación",
      copy: "Copiar",
      copied: "¡Copiado!",
      error: "No se pudo crear el enlace. Intenta de nuevo.",
    },
    currency: {
      heading: "Moneda de visualización",
      /** The three things a reader has to know before converting (T105). */
      explainChanges:
        "Convertir recalcula los montos, los balances y el plan de pago —todo lo que el grupo " +
        "deriva— a una tasa fija. Aplica a todos los miembros, no solo a quien lo hace.",
      explainReversible:
        "Es reversible: al volver, cada moneda se muestra otra vez con sus montos originales.",
      explainFrozen:
        "Una vez convertido, los números dejan de moverse: ningún trabajo automático, caché ni " +
        "“esto se ve viejo” los cambia. Volver a fijar las tasas es la única acción que lo hace.",
      targetLabel: "Convertir a",
      convert: "Convertir",
      currentlyIn: (currency: string) => `El grupo se muestra en ${currency}.`,
      pinLine: (from: string, to: string, rate: string, date: string, source: string) =>
        `${from} → ${to}: ${rate} · tasa del ${date} · ${source}`,
      revert: "Volver a monedas originales",
      repin: "Volver a fijar tasas de hoy",
      confirmConvertTitle: "Convertir la vista del grupo",
      confirmConvertBody: (currency: string) =>
        `Vas a mostrar en ${currency} todos los montos del grupo —gastos, balances y el plan de ` +
        `pago—, para todos los miembros.`,
      confirmConvertCta: "Convertir",
      confirmRepinTitle: "Volver a fijar las tasas",
      confirmRepinBody: (currency: string) =>
        `Vas a re-fijar las tasas de ${currency} a las de hoy. Esto sí mueve los números ya convertidos.`,
      confirmRepinCta: "Re-fijar",
      /** The per-pair rate preview shown before the write (T105). */
      ratePreviewHeading: "Tasas que se van a fijar",
      ratePreviewLine: (from: string, to: string, rate: string, source: string, date: string) =>
        `${from} → ${to}: ${rate} · ${source}, ${date}`,
      ratePreviewLoading: "Consultando las tasas de hoy…",
      ratePreviewUnavailable: (from: string, to: string) =>
        `${from} → ${to}: sin tasa disponible hoy — no se podrá convertir esta moneda`,
      provenance: (date: string, source: string) => `Se fijará la tasa de ${source} del ${date} para cada moneda del grupo.`,
      everyoneWarning: "Todos los miembros verán los montos convertidos.",
      cancel: "Cancelar",
      error: "No se pudo cambiar la moneda. Intenta de nuevo.",
    },
    meta: {
      heading: "Grupo",
      titleLabel: "Título",
      descriptionLabel: "Descripción",
      save: "Guardar cambios",
      saving: "Guardando…",
      archive: "Archivar grupo",
      archived: "Grupo archivado",
      archiveTitle: "Archivar grupo",
      archiveConfirm: (title: string) => `¿Archivar "${title}"? Dejará de aparecer como activo, pero no se elimina.`,
      cancel: "Cancelar",
      error: "No se pudo guardar. Intenta de nuevo.",
    },
  },
  settlements: {
    record: "Registrar pago",
    recordTitle: "Registrar un pago",
    historyHeading: "Pagos registrados",
    historyEmpty: "Aún no hay pagos registrados.",
    paidPhrase: (from: string, to: string) => `${from} le pagó a ${to}`,
    edit: "Editar",
    editTitle: "Editar pago",
    delete: "Eliminar",
    deleteTitle: "Eliminar pago",
    deleteConfirm: (phrase: string) => `${phrase}. Esta acción no se puede deshacer.`,
    cancel: "Cancelar",
    saveError: "No se pudo registrar el pago. Intenta de nuevo.",
    deleteError: "No se pudo eliminar el pago. Intenta de nuevo.",
    form: {
      toLabel: "¿A quién le pagaste?",
      amountLabel: (currency: string) => `Monto (${currency})`,
      amountNotPositive: "Ingresa un monto mayor que cero.",
      currencyLabel: "Moneda",
      /** The transfer amount spelled out — the debt is in `debt`'s currency,
       * `transfer` is the COP you actually wire (T104). */
      transferHint: (debt: string, transfer: string) =>
        `Para pagar ${debt} necesitas transferir ${transfer}`,
      rateProvenance: (source: string, date: string) => `tasa de ${source}, ${date}`,
      dateLabel: "Fecha",
      noteLabel: "Nota",
      noteHint: "Opcional. Máximo 500 caracteres.",
      cancel: "Cancelar",
      submit: "Guardar",
      submitting: "Guardando…",
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
