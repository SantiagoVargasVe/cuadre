import "server-only";

/**
 * Spanish copy for the messages this app sends by email. Deliberately
 * **not** in `src/lib/i18n/es.ts`: that module is imported by client
 * components and ships in the browser bundle, and a mail body has no
 * business there — the same reason `legal-es.ts` is kept apart.
 *
 * Every message is a link and an expiry, nothing else: no password, no
 * group name, no amounts, no third-party link, no remote image, no
 * tracking pixel (ADR-0011 § What this costs the privacy posture).
 */
export const mailEs = {
  verifyEmail: {
    subject: "Verifica tu correo en Cuadre",
    heading: "Verifica tu correo",
    body:
      "Confirma esta dirección para poder restablecer tu contraseña sin ayuda del Operador si " +
      "alguna vez la olvidas. Puedes seguir usando Cuadre con normalidad aunque no la verifiques.",
    cta: "Verificar correo",
    linkFallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
    expiry: "El enlace caduca en 24 horas y solo puede usarse una vez.",
    ignore: "Si no creaste una cuenta en Cuadre, ignora este mensaje.",
  },
  passwordReset: {
    subject: "Restablece tu contraseña de Cuadre",
    heading: "Restablece tu contraseña",
    body:
      "Alguien —esperamos que tú— pidió restablecer la contraseña de esta cuenta. Abre el enlace " +
      "para elegir una nueva.",
    cta: "Restablecer contraseña",
    linkFallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
    expiry: "El enlace caduca en 30 minutos y solo puede usarse una vez.",
    ignore:
      "Si no lo pediste, ignora este mensaje: tu contraseña no cambia hasta que abras el enlace.",
  },
} as const;
