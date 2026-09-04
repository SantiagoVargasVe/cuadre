export const legalEs = {
  common: {
    version: (value: string) => `Versión ${value}`,
    effectiveDate: (value: string) => `Vigente desde el ${value}`,
    backToApp: "Volver a Cuadre",
    newTab: "(abre en una pestaña nueva)",
  },
  terms: {
    title: "Términos de servicio",
    description: "Condiciones para usar Cuadre y participar en grupos de gastos compartidos.",
    intro:
      "Estos términos regulan el uso de esta instancia de Cuadre. Al crear una cuenta confirmas que los leíste y los aceptas.",
    sections: [
      {
        title: "1. Qué es Cuadre",
        paragraphs: [
          "Cuadre es una herramienta para registrar gastos compartidos, calcular saldos y proponer pagos entre integrantes de un grupo. No es un banco, una billetera, un servicio de pagos ni un asesor financiero.",
          "La persona que administra esta instancia es el Operador. Cuadre es software autohospedado: las condiciones operativas concretas dependen de esa instancia.",
        ],
        bullets: [],
      },
      {
        title: "2. Cuenta e invitaciones",
        paragraphs: [
          "El registro requiere una invitación. Debes proporcionar información correcta, proteger tu contraseña y avisar al Operador si crees que alguien accedió a tu cuenta.",
          "Cuadre no verifica el correo electrónico y actualmente no ofrece recuperación automática de contraseña. Una dirección incorrecta puede impedirte recuperar el acceso.",
        ],
        bullets: [],
      },
      {
        title: "3. Grupos y contenido",
        paragraphs: [
          "Solo los integrantes actuales pueden consultar el libro de gastos de un grupo. Tu nombre visible, avatar y actividad dentro del grupo serán visibles para los demás integrantes.",
          "Cualquier integrante puede crear, editar o eliminar gastos y pagos del grupo. Las eliminaciones son lógicas y los cambios de gastos conservan historial para que el grupo pueda revisar qué ocurrió.",
          "Eres responsable de que la información que agregues sea pertinente, lícita y respetuosa de las demás personas. No publiques secretos, datos sensibles ni información que no necesite el grupo.",
        ],
        bullets: [],
      },
      {
        title: "4. Cálculos y monedas",
        paragraphs: [
          "Los saldos dependen de la información registrada por los integrantes. Revisa los gastos y acuerdos reales antes de transferir dinero.",
          "Las conversiones de moneda son informativas. Cuando un grupo fija una tasa, Cuadre conserva esa referencia hasta que un integrante decide volver a fijarla; no garantiza una tasa bancaria o de mercado disponible para una transferencia real.",
        ],
        bullets: [],
      },
      {
        title: "5. Uso permitido",
        paragraphs: ["No puedes usar Cuadre para:"],
        bullets: [
          "acceder a cuentas o grupos sin autorización;",
          "interferir con la seguridad o disponibilidad de la instancia;",
          "publicar contenido ilícito o vulnerar derechos de otras personas;",
          "engañar deliberadamente a un grupo sobre gastos, pagos o identidades.",
        ],
      },
      {
        title: "6. Disponibilidad y conservación",
        paragraphs: [
          "El servicio se ofrece según la disponibilidad de la instancia y puede cambiar, interrumpirse o dejar de operar. El Operador es responsable de definir y ejecutar sus copias de seguridad; Cuadre no promete que los datos puedan recuperarse después de una pérdida.",
          "Archivar un grupo no elimina su libro. Cuadre no ofrece actualmente una eliminación automática de cuentas, porque una cuenta puede formar parte del historial financiero compartido de otras personas.",
        ],
        bullets: [],
      },
      {
        title: "7. Cambios y contacto",
        paragraphs: [
          "Una versión futura puede modificar estos términos. La versión y su fecha de vigencia se publicarán en esta página y, cuando corresponda, se podrá solicitar una nueva aceptación.",
          "Para consultas sobre estos términos, contacta al Operador por el canal mediante el cual recibiste acceso a esta instancia o la invitación a tu grupo.",
        ],
        bullets: [],
      },
    ],
  },
  privacy: {
    title: "Política de privacidad",
    description: "Cómo esta instancia de Cuadre trata los datos personales de sus usuarios.",
    intro:
      "Esta política explica qué información trata Cuadre, para qué se usa y qué opciones tienes. Al crear una cuenta confirmas que la leíste y autorizas el tratamiento descrito.",
    sections: [
      {
        title: "1. Responsable y contacto",
        paragraphs: [
          "El responsable del tratamiento es la persona que administra y pone a disposición esta instancia de Cuadre, en adelante el Operador. Como Cuadre puede ser autohospedado por distintas personas, sus datos de contacto son los comunicados junto con el acceso a esta instancia.",
          "Para consultar, actualizar, rectificar o solicitar la supresión de tus datos, o revocar una autorización cuando corresponda, contacta al Operador por el canal mediante el cual recibiste acceso o una invitación. Identifica tu cuenta y describe claramente tu solicitud; el Operador puede pedir información razonable para verificar tu identidad y responderá dentro de los plazos aplicables.",
        ],
        bullets: [],
      },
      {
        title: "2. Datos que tratamos",
        paragraphs: ["Cuadre puede tratar las siguientes categorías:"],
        bullets: [
          "datos de cuenta: correo electrónico, nombre visible, hash de contraseña y avatar elegido;",
          "datos de grupos: invitaciones, membresías, funciones de propietario o integrante y fechas asociadas;",
          "contenido financiero compartido: títulos, fechas, monedas, montos, participantes, divisiones, pagos, notas, categorías e historial de cambios;",
          "datos técnicos necesarios: sesión, identificadores internos y dirección IP utilizada para limitar intentos abusivos en rutas públicas.",
        ],
      },
      {
        title: "3. Finalidades",
        paragraphs: ["Usamos esos datos para:"],
        bullets: [
          "crear y autenticar tu cuenta;",
          "gestionar invitaciones y acceso a grupos;",
          "mostrar el libro compartido, calcular saldos y preparar planes de pago;",
          "mantener historial, integridad, seguridad y límites contra abuso;",
          "operar, diagnosticar y respaldar la instancia.",
        ],
      },
      {
        title: "4. Quién puede ver la información",
        paragraphs: [
          "Los integrantes actuales de un grupo pueden ver su contenido, los nombres visibles y los avatares de los demás integrantes. No reciben las direcciones de correo de otras personas.",
          "El Operador y quienes administren técnicamente la infraestructura pueden tener acceso cuando sea necesario para operar, proteger, respaldar o recuperar la instancia. No se envían datos del usuario al proveedor diario de tasas de cambio.",
          "Cuadre no incorpora analítica, publicidad, seguimiento ni venta de datos personales.",
        ],
        bullets: [],
      },
      {
        title: "5. Cookies y seguridad",
        paragraphs: [
          "Cuadre usa una cookie de sesión necesaria para mantener tu acceso. En producción es httpOnly, Secure y SameSite=Lax; no es una cookie publicitaria.",
          "Las contraseñas se almacenan mediante un hash Argon2id y el acceso a cada grupo se comprueba por membresía. Ningún sistema es infalible: protege tu contraseña y reporta cualquier acceso sospechoso al Operador.",
        ],
        bullets: [],
      },
      {
        title: "6. Conservación",
        paragraphs: [
          "Los datos se conservan mientras sean necesarios para operar la cuenta y los grupos, mantener la integridad del libro compartido, atender solicitudes o cumplir obligaciones aplicables.",
          "Los gastos y pagos eliminados se conservan de forma lógica y los cambios de gastos mantienen revisiones. Las membresías retiradas y los grupos archivados preservan su historial. Las aceptaciones legales conservan el documento, la versión y la fecha del servidor.",
          "Cuadre no ofrece actualmente eliminación automática de cuentas. Una solicitud de supresión puede estar limitada cuando afecte el historial compartido o exista otra razón legítima para conservar información; el Operador debe evaluar cada solicitud.",
        ],
        bullets: [],
      },
      {
        title: "7. Tus derechos",
        paragraphs: [
          "Puedes solicitar acceso a tus datos, su actualización o rectificación, conocer el uso dado a ellos y, cuando corresponda, pedir su supresión o revocar la autorización. También puedes presentar consultas o reclamos ante el Operador por el procedimiento descrito en la sección de contacto.",
          "Puedes cambiar tu nombre visible y avatar desde tu cuenta. La corrección de información del libro debe coordinarse con el grupo, porque los cambios quedan asociados al historial compartido.",
        ],
        bullets: [],
      },
      {
        title: "8. Cambios a esta política",
        paragraphs: [
          "Las modificaciones se publicarán con una nueva versión y fecha de vigencia. Si el cambio es sustancial, el Operador deberá comunicarlo de forma apropiada antes de aplicar el nuevo tratamiento y podrá solicitar una nueva aceptación.",
        ],
        bullets: [],
      },
    ],
  },
} as const;
