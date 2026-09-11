/**
 * Seed completo de Aulnea:
 *  - Institución demo
 *  - Admin 1155218177/1155218177 (rector)
 *  - Usuarios de cada rol (docente, coordinador, director, orientador, acudiente)
 *  - Grupos, asignaturas, periodos, estudiantes
 *  - Spaces, posts, comentarios, reacciones
 *  - Talleres, observaciones, atenciones de orientación
 *  - Reuniones / actas
 *  - Badges
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

function hashPassword(p: string): string {
  return crypto.createHash("sha256").update(p).digest("hex");
}

function rnd(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log("→ Limpiando base de datos...");
  await db.syncOp.deleteMany();
  await db.userBadge.deleteMany()
  await db.badge.deleteMany()
  await db.notification.deleteMany()
  await db.message.deleteMany()
  await db.reaction.deleteMany()
  await db.comment.deleteMany()
  await db.post.deleteMany()
  await db.spaceMember.deleteMany()
  await db.space.deleteMany()
  await db.meetingSigner.deleteMany()
  await db.meeting.deleteMany()
  await db.orientation.deleteMany()
  await db.observation.deleteMany()
  await db.attendance.deleteMany()
  await db.enrollment.deleteMany()
  await db.workshop.deleteMany()
  await db.grade.deleteMany()
  await db.period.deleteMany()
  await db.subjectAssignment.deleteMany()
  await db.subject.deleteMany()
  await db.student.deleteMany()
  await db.group.deleteMany()
  await db.auditLog.deleteMany()
  await db.user.deleteMany()
  await db.institution.deleteMany()

  console.log("→ Creando institución...");
  const inst = await db.institution.create({
    data: {
      name: "Institución Educativa Aulnea",
      shortName: "IE Aulnea",
      nit: "900.123.456-7",
      dane: "305001001",
      address: "Calle 12 # 34-56, Bogotá",
      phone: "+57 601 555 1234",
      email: "rectoria@ieaulnea.edu.co",
      academicYear: "2025",
      logoUrl: "/icon.svg",
    },
  })

  console.log("→ Creando usuarios por rol...");
  // Admin rector con credenciales 1155218177 / 1155218177
  const rector = await db.user.create({
    data: {
      institutionId: inst.id,
      username: "1155218177",
      passwordHash: hashPassword("1155218177"),
      fullName: "Gloria Inés Restrepo Marín",
      role: "rector",
      email: "grestrepo@ieaulnea.edu.co",
      phone: "+57 310 555 1001",
      jobTitle: "Rectora",
      active: true,
    },
  })

  const coordinador = await db.user.create({
    data: {
      institutionId: inst.id,
      username: "coordinacion",
      passwordHash: hashPassword("aulnea123"),
      fullName: "Carlos Andrés Gómez Pineda",
      role: "coordinador",
      email: "cgomez@ieaulnea.edu.co",
      phone: "+57 310 555 1002",
      jobTitle: "Coordinador Académico",
    },
  })

  const director = await db.user.create({
    data: {
      institutionId: inst.id,
      username: "director",
      passwordHash: hashPassword("aulnea123"),
      fullName: "María Camila Torres Vega",
      role: "director_grupo",
      email: "mtorres@ieaulnea.edu.co",
      phone: "+57 310 555 1003",
      jobTitle: "Docente - Director 8°A",
    },
  })

  const docente = await db.user.create({
    data: {
      institutionId: inst.id,
      username: "docente",
      passwordHash: hashPassword("aulnea123"),
      fullName: "Javier Esteban Ruiz Cardona",
      role: "docente",
      email: "jruiz@ieaulnea.edu.co",
      phone: "+57 310 555 1004",
      jobTitle: "Docente Matemáticas",
    },
  })

  const orientador = await db.user.create({
    data: {
      institutionId: inst.id,
      username: "orientacion",
      passwordHash: hashPassword("aulnea123"),
      fullName: "Diana Marcela Quintero Soto",
      role: "orientador",
      email: "dquintero@ieaulnea.edu.co",
      phone: "+57 310 555 1005",
      jobTitle: "Psicóloga / Orientadora Escolar",
    },
  })

  const acudiente = await db.user.create({
    data: {
      institutionId: inst.id,
      username: "acudiente",
      passwordHash: hashPassword("aulnea123"),
      fullName: "Luis Alberto Moreno Ortiz",
      role: "acudiente",
      email: "lmoreno@gmail.com",
      phone: "+57 311 678 9012",
      jobTitle: "Acudiente",
    },
  })

  const administrativo = await db.user.create({
    data: {
      institutionId: inst.id,
      username: "administrativo",
      passwordHash: hashPassword("aulnea123"),
      fullName: "Sandra Patricia Villegas Loaiza",
      role: "administrativo",
      email: "svillegas@ieaulnea.edu.co",
      phone: "+57 310 555 1007",
      jobTitle: "Constructor de módulos y sistemas",
    },
  })

  console.log("→ Creando grupos, asignaturas, periodos...");
  const groups = []
  for (const g of ["6°A", "6°B", "7°A", "8°A", "8°B", "9°A", "10°A", "11°A"]) {
    const grade = g.replace(/[°AB]/g, "")
    const group = await db.group.create({
      data: {
        institutionId: inst.id,
        name: g,
        grade,
        section: g.includes("A") ? "A" : "B",
        headTeacherId: g === "8°A" ? director.id : docente.id,
      },
    })
    groups.push(group)
  }

  const subjects = []
  for (const s of [
    { name: "Matemáticas", code: "MAT", area: "Ciencias" },
    { name: "Lengua Castellana", code: "LEN", area: "Humanidades" },
    { name: "Ciencias Naturales", code: "CNA", area: "Ciencias" },
    { name: "Sociales", code: "SOC", area: "Humanidades" },
    { name: "Inglés", code: "ING", area: "Humanidades" },
    { name: "Educación Física", code: "EDF", area: "Artes" },
    { name: "Tecnología", code: "TEC", area: "Tecnología" },
  ]) {
    const subject = await db.subject.create({
      data: {
        institutionId: inst.id,
        ...s,
      },
    })
    subjects.push(subject)
  }

  // Periodos académicos (4 periodos)
  const periods = []
  const periodNames = ["Periodo 1", "Periodo 2", "Periodo 3", "Periodo 4"]
  for (let i = 0; i < 4; i++) {
    const start = new Date(2025, i * 3, 15)
    const end = new Date(2025, i * 3 + 3, 14)
    const p = await db.period.create({
      data: {
        institutionId: inst.id,
        name: periodNames[i],
        startDate: start,
        endDate: end,
        weight: 25,
        active: i === 1, // Periodo 2 activo
        closed: i === 0, // Periodo 1 cerrado
      },
    })
    periods.push(p)
  }

  // Asignaciones docente-asignatura-grupo
  for (const g of groups) {
    for (const s of subjects.slice(0, 5)) {
      await db.subjectAssignment.create({
        data: {
          institutionId: inst.id,
          groupId: g.id,
          subjectId: s.id,
          teacherId: s.code === "MAT" ? docente.id : director.id,
          weeklyHours: s.code === "MAT" ? 4 : 3,
        },
      })
    }
  }

  console.log("→ Creando estudiantes...");
  const firstNamesM = ["Santiago", "Mateo", "Juan", "Diego", "Ángel", "David", "Sebastián", "Andrés"]
  const firstNamesF = ["Valentina", "Mariana", "Sara", "Lucía", "Martina", "Sofía", "Camila", "Isabella"]
  const lastNames = ["Gómez", "Rodríguez", "Martínez", "López", "García", "Pérez", "Torres", "Ramírez", "Vargas", "Castro"]

  const allStudents = []
  for (const g of groups) {
    for (let i = 0; i < 18; i++) {
      const isF = Math.random() > 0.5
      const fn = isF ? rnd(firstNamesF) : rnd(firstNamesM)
      const ln1 = rnd(lastNames)
      const ln2 = rnd(lastNames)
      const birthYear = 2025 - parseInt(g.grade) - 5
      const student = await db.student.create({
        data: {
          institutionId: inst.id,
          groupId: g.id,
          code: `${g.grade}${g.section}${String(i + 1).padStart(2, "0")}-2025`,
          firstName: fn,
          lastName: `${ln1} ${ln2}`,
          birthDate: new Date(birthYear, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          gender: isF ? "F" : "M",
          address: `Calle ${Math.floor(Math.random() * 100)} # ${Math.floor(Math.random() * 50)}-${Math.floor(Math.random() * 100)}`,
          guardianName: `${rnd(["Carlos", "Luis", "Ana", "Marta", "José", "Patricia"])} ${ln1} ${ln2}`,
          guardianPhone: `+57 31${Math.floor(Math.random() * 9)} ${Math.floor(Math.random() * 9000000 + 1000000)}`,
          guardianEmail: `acudiente.${i}@example.com`,
          guardianRelation: rnd(["Padre", "Madre", "Abuelo", "Tío"]),
          status: "activo",
          enrollmentDate: new Date(2025, 0, 15),
        },
      })
      allStudents.push(student)
    }
  }

  // Conectar un estudiante específico al acudiente (para demo)
  const acudido = allStudents.find(s => s.code.startsWith("8A"))
  if (acudido) {
    await db.student.update({
      where: { id: acudido.id },
      data: {
        guardianName: acudiente.fullName,
        guardianPhone: acudiente.phone,
        guardianEmail: acudiente.email,
      },
    })
  }

  console.log("→ Creando notas, asistencias, observaciones...");
  // Crear notas del periodo 1 (cerrado) y periodo 2 (activo)
  for (const student of allStudents.slice(0, 80)) {
    for (const subj of subjects.slice(0, 5)) {
      // Periodo 1 (cerrado, con notas definitivas)
      const val1 = 30 + Math.floor(Math.random() * 70)
      const perf1 = val1 >= 90 ? "superior" : val1 >= 70 ? "alto" : val1 >= 50 ? "basico" : "bajo"
      await db.grade.create({
        data: {
          studentId: student.id,
          subjectId: subj.id,
          periodId: periods[0].id,
          teacherId: docente.id,
          value: val1,
          performance: perf1,
        },
      })

      // Periodo 2 (activo, algunas notas)
      if (Math.random() > 0.3) {
        const val2 = 30 + Math.floor(Math.random() * 70)
        const perf2 = val2 >= 90 ? "superior" : val2 >= 70 ? "alto" : val2 >= 50 ? "basico" : "bajo"
        await db.grade.create({
          data: {
            studentId: student.id,
            subjectId: subj.id,
            periodId: periods[1].id,
            teacherId: docente.id,
            value: val2,
            performance: perf2,
          },
        })
      }
    }
  }

  // Asistencia de hoy y días previos para 8°A
  const group8A = groups.find(g => g.name === "8°A")
  const students8A = allStudents.filter(s => s.groupId === group8A?.id)
  for (let d = 0; d < 5; d++) {
    for (const s of students8A) {
      const r = Math.random()
      const status = r > 0.92 ? "ausente" : r > 0.86 ? "tarde" : r > 0.84 ? "excusa" : "presente"
      await db.attendance.create({
        data: {
          studentId: s.id,
          groupId: group8A!.id,
          date: daysAgo(d),
          status,
          recordedById: director.id,
          notifiedAt: status !== "presente" ? daysAgo(d) : null,
        },
      })
    }
  }

  // Observaciones
  const obsCategories = ["academico", "convivencia", "asistencia"]
  const obsDescriptions = [
    "Falla reiterada en entregas de talleres del periodo.",
    "Comportamiento disruptivo durante la clase de matemáticas.",
    "Llegadas tarde acumuladas en la semana.",
    "Actitud colaborativa destacada en trabajo de equipo.",
    "Solicitud de apoyo académico por dificultades familiares.",
    "Participación sobresaliente en proyecto de aula.",
    "Conflicto verbal con otro estudiante en descanso.",
    "Mejoría sostenida tras plan de mejora aplicado.",
  ]
  for (let i = 0; i < 25; i++) {
    const s = rnd(allStudents)
    const cat = rnd(obsCategories)
    await db.observation.create({
      data: {
        studentId: s.id,
        recordedById: docente.id,
        date: daysAgo(Math.floor(Math.random() * 30)),
        category: cat,
        type: cat === "convivencia" ? rnd(["Tipo I", "Tipo II", "Tipo III"]) : null,
        description: rnd(obsDescriptions),
        severity: rnd(["baja", "media", "alta"]),
        status: rnd(["abierta", "en_seguimiento", "cerrada"]),
      },
    })
  }

  // Orientaciones
  for (let i = 0; i < 12; i++) {
    await db.orientation.create({
      data: {
        studentId: rnd(allStudents).id,
        orientedById: orientador.id,
        date: daysAgo(Math.floor(Math.random() * 45)),
        modality: rnd(["individual", "grupal"]),
        reason: rnd([
          "Dificultades académicas en matemáticas",
          "Manejo de emociones",
          "Conflicto con pares",
          "Apoyo en proceso de inclusión",
          "Charla sobre hábitos de estudio",
        ]),
        notes: "Se realiza sesión de orientación con enfoque cognitivo-conductual. Se acuerdan compromisos.",
        followUp: "Revisar avances en dos semanas con docente de área.",
        status: rnd(["abierta", "abierta", "cerrada"]),
      },
    })
  }

  console.log("→ Creando talleres...");
  for (let i = 0; i < 15; i++) {
    await db.workshop.create({
      data: {
        institutionId: inst.id,
        subjectId: rnd(subjects).id,
        title: `Taller ${i + 1} — ${rnd(["Operaciones básicas", "Lectura comprensiva", "Ecosistemas", "Civismo", "Verbos irregulares"])}`,
        description: "Taller con actividades guiadas, rúbrica de evaluación y cierre reflexivo. Diseñado para una sesión de 90 minutos.",
        level: rnd(["6°", "7°", "8°", "9°", "10°", "11°"]),
        duration: rnd([45, 60, 90, 120]),
        tags: rnd(["evaluable", "repaso", "proyecto", "casa", "clase"]),
      },
    })
  }

  console.log("→ Creando actas / reuniones...");
  const meetingData = [
    {
      title: "Comité Académico — Periodo 1",
      type: "comité",
      agenda: "1. Análisis de resultados periodo 1\n2. Estudiantes en riesgo\n3. Plan de mejora periodo 2",
      minutes: "Se reúne el Comité Académico conforme al SIE. Se analizan resultados generales del periodo 1: 12 estudiantes en riesgo académico, principalmente en matemáticas y ciencias. Se aprueba plan de refuerzo. Se designan docentes responsables. Próxima reunión: cierre de periodo 2.",
    },
    {
      title: "Comité de Convivencia — Situación Tipo II",
      type: "comité",
      agenda: "1. Caso 8°B — conflicto entre pares\n2. Descargos\n3. Medidas formativas",
      minutes: "Se estudia situación Tipo II reportada el 12 de agosto. Se escuchan descargos de los estudiantes involucrados. Se acuerdan medidas pedagógicas: trabajo comunitario, acompañamiento de orientación y compromiso firmado por acudientes.",
    },
    {
      title: "Consejo Directivo — Aprobación Presupuesto",
      type: "directivo",
      agenda: "1. Presupuesto 2025\n2. Proyectos de mejora\n3. Dotación",
      minutes: "El Consejo Directivo aprueba el presupuesto institucional para el año 2025. Se asignan recursos para dotación de laboratorios, capacitación docente y mejoras de infraestructura. Se delega a rectoría la ejecución.",
    },
  ]
  for (const m of meetingData) {
    await db.meeting.create({
      data: {
        institutionId: inst.id,
        title: m.title,
        type: m.type,
        date: daysAgo(Math.floor(Math.random() * 60) + 5),
        location: "Sala de juntas — Rectoría",
        agenda: m.agenda,
        minutes: m.minutes,
        signed: true,
        signedAt: daysAgo(Math.floor(Math.random() * 50)),
        signedBy: rector.fullName,
        hash: crypto.randomBytes(20).toString("hex"),
      },
    })
  }

  console.log("→ Creando spaces y feed...");
  const spaces = []
  const spaceDefs = [
    { name: "Docentes — Generales", slug: "docentes", type: "group", desc: "Espacio institucional del cuerpo docente." },
    { name: "8°A — Comunicaciones", slug: "8a-comunicaciones", type: "grade", desc: "Anuncios y comunicaciones del grupo 8°A." },
    { name: "Área de Ciencias", slug: "ciencias", type: "area", desc: "Coordinación del área de ciencias." },
    { name: "Acudientes 8°A", slug: "acudientes-8a", type: "parents", desc: "Space para acudientes del 8°A." },
    { name: "Proyecto Ambiental", slug: "proyecto-ambiental", type: "project", desc: "PRAE — Proyecto Ambiental Escolar." },
    { name: "Comité de Convivencia", slug: "convivencia", type: "committee", desc: "Comité escolar de convivencia." },
  ]
  for (const sd of spaceDefs) {
    const sp = await db.space.create({
      data: {
        institutionId: inst.id,
        name: sd.name,
        slug: sd.slug,
        description: sd.desc,
        type: sd.type,
        visibility: "public",
        memberCount: Math.floor(Math.random() * 30) + 8,
      },
    })
    spaces.push(sp)
  }

  // Membership básica
  for (const sp of spaces) {
    await db.spaceMember.create({
      data: { spaceId: sp.id, userId: rector.id, role: "admin" },
    })
    await db.spaceMember.create({
      data: { spaceId: sp.id, userId: docente.id, role: "member" },
    })
  }

  // Posts
  const postsData = [
    { space: spaces[0], author: rector, content: "Recordatorio: el cierre del Periodo 2 es el próximo viernes. Todos los docentes deben subir notas antes de las 5pm. Gracias por el compromiso con nuestros estudiantes.", pinned: true },
    { space: spaces[0], author: coordinador, content: "Comparto el formato actualizado del pre-informe para estudiantes en riesgo. Identifiquemos temprano para acompañar mejor. @docente @director" },
    { space: spaces[1], author: director, content: "Acudientes del 8°A: mañana sesión de orientación grupal a las 2pm. Tema: hábitos de estudio. Confirmar asistencia.", pinned: true },
    { space: spaces[2], author: docente, content: "Banco de talleres de ciencias actualizado. Agregué 3 talleres nuevos sobre ecosistemas. Útiles para ausencias docentes.", poll: "¿Qué tema prefieren para el próximo taller?", options: ["Ecosistemas", "Célula", "Energía", "Materia"] },
    { space: spaces[3], author: director, content: "Feliz cumpleaños a @Santiago y @Valentina del 8°A esta semana. Que tengan un día lleno de alegrías." },
    { space: spaces[4], author: docente, content: "Avance del Proyecto Ambiental: ya tenemos el diagnóstico del consumo de agua. Próxima reunión el viernes en el descanso." },
    { space: spaces[0], author: orientador, content: "Recordatorio institucional: cualquier remisión al área de orientación debe registrarse en el módulo de Orientación Escolar con notas y seguimiento." },
    { space: spaces[1], author: director, content: "Excelente participación del 8°A en la actividad de gobierno escolar. Resultados en vivo pronto." },
  ]

  for (const p of postsData) {
    const post = await db.post.create({
      data: {
        institutionId: inst.id,
        spaceId: p.space.id,
        authorId: p.author.id,
        content: p.content,
        pollQuestion: p.poll || null,
        pollOptionsJson: p.options ? JSON.stringify(p.options) : null,
        pinned: p.pinned || false,
        mentionsJson: JSON.stringify([]),
        tagsJson: JSON.stringify(p.space.type === "committee" ? ["convivencia"] : ["institucional"]),
        createdAt: daysAgo(Math.floor(Math.random() * 14)),
      },
    })

    // Comentarios y reacciones
    const numComments = Math.floor(Math.random() * 4)
    for (let i = 0; i < numComments; i++) {
      await db.comment.create({
        data: {
          postId: post.id,
          authorId: rnd([docente.id, director.id, coordinador.id, orientador.id]).id || docente.id,
          content: rnd([
            "Gracias por la información.",
            "Tomamos nota y aplicamos.",
            "¿Podemos coordinar una reunión breve?",
            "Excelente iniciativa.",
            "Comparto la propuesta con el equipo.",
          ]),
          createdAt: daysAgo(Math.floor(Math.random() * 7)),
        },
      })
    }

    const reactions = ["like", "love", "celebrate", "insightful"]
    for (let i = 0; i < Math.floor(Math.random() * 6); i++) {
      await db.reaction.create({
        data: {
          postId: post.id,
          userId: rnd([docente.id, director.id, coordinador.id, orientador.id, rector.id]),
          emoji: rnd(reactions),
        },
      })
    }
  }

  console.log("→ Creando notificaciones...");
  const notifTypes = [
    { type: "period_close", title: "Cierre de Periodo 2", body: "5 días restantes para subir notas." },
    { type: "attendance", title: "Inasistencia registrada", body: "Su acudido no asistió hoy a clase." },
    { type: "mention", title: "Mención en publicación", body: "Carlos Gómez te mencionó en un post." },
    { type: "vote", title: "Gobierno escolar", body: "Resultados disponibles — participación 87%." },
    { type: "reply", title: "Nueva respuesta", body: "María Torres respondió tu comentario." },
  ]
  for (const n of notifTypes) {
    await db.notification.create({
      data: {
        userId: rector.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: Math.random() > 0.5,
        channel: "in_app",
      },
    })
  }

  console.log("→ Creando badges...");
  const badgeDefs = [
    { name: "Docente Excelente", description: "Por resultados sobresalientes en evaluación institucional." },
    { name: "Mentor del Año", description: "Por acompañamiento a estudiantes en riesgo." },
    { name: "Comunidad Activa", description: "Por participación consistente en el feed institucional." },
    { name: "Convivencia Constructiva", description: "Por aportes al comité de convivencia." },
    { name: "Innovador Pedagógico", description: "Por implementar prácticas pedagógicas destacadas." },
  ]
  for (const b of badgeDefs) {
    const badge = await db.badge.create({ data: b })
    // Asignar a docente y director
    await db.userBadge.create({ data: { userId: docente.id, badgeId: badge.id } })
    if (Math.random() > 0.5) {
      await db.userBadge.create({ data: { userId: director.id, badgeId: badge.id } })
    }
  }

  console.log("→ Creando matrículas / solicitudes...");
  for (let i = 0; i < 8; i++) {
    await db.enrollment.create({
      data: {
        institutionId: inst.id,
        applicantName: `${rnd(firstNamesM.concat(firstNamesF))} ${rnd(lastNames)}`,
        applicantBirthDate: new Date(2015 - Math.floor(Math.random() * 6), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        applicantGrade: rnd(["1°", "2°", "3°", "6°", "7°", "8°"]),
        guardianName: `${rnd(["Ana", "Carlos", "Luis", "Marta"])} ${rnd(lastNames)}`,
        guardianPhone: `+57 31${Math.floor(Math.random() * 9)} ${Math.floor(Math.random() * 9000000 + 1000000)}`,
        guardianEmail: `acudiente.${i}@gmail.com`,
        status: rnd(["solicitada", "solicitada", "en_revision", "aprobada", "rechazada", "matriculado"]),
        type: rnd(["matricula", "pre_matricula"]),
      },
    })
  }

  console.log("→ Creando módulos personalizados de demostración...");

  // Limpiar módulos custom existentes
  await db.customModuleRecord.deleteMany();
  await db.customModule.deleteMany();

  // Módulo 1: Permiso de salida estudiantil
  const mod1 = await db.customModule.create({
    data: {
      institutionId: inst.id,
      createdById: administrativo.id,
      name: "Permiso de salida estudiantil",
      slug: "permiso_salida",
      description: "Solicitud formal de permiso para que un estudiante salga del colegio durante la jornada escolar.",
      icon: "FileText",
      area: "Convivencia",
      menuLabel: "Permiso de salida",
      tabOrientation: "horizontal",
      tabLabelsJson: JSON.stringify(["Permisos solicitados", "Solicitar permiso"]),
      fieldsJson: JSON.stringify([
        { id: "f1", name: "estudiante", label: "Estudiante", type: "student", required: true, width: "half", helpText: "Seleccione al estudiante de la lista." },
        { id: "f2", name: "fecha_salida", label: "Fecha y hora de salida", type: "date", required: true, width: "half" },
        { id: "f3", name: "motivo", label: "Motivo del permiso", type: "select", required: true, width: "half", options: [
          { label: "Cita médica", value: "cita_medica" },
          { label: "Calamidad doméstica", value: "calamidad" },
          { label: "Trámite personal", value: "tramite" },
          { label: "Otro", value: "otro" },
        ]},
        { id: "f4", name: "acompañante", label: "Persona que recoge al estudiante", type: "text", required: true, width: "half", placeholder: "Nombre completo del acudiente o autorizado" },
        { id: "f5", name: "detalle", label: "Detalle del motivo", type: "textarea", required: true, width: "full", rows: 3, placeholder: "Explique brevemente el motivo del permiso." },
        { id: "f6", name: "regreso", label: "¿El estudiante regresa al colegio el mismo día?", type: "radio", required: true, width: "half", options: [
          { label: "Sí, regresa hoy", value: "si" },
          { label: "No, no regresa", value: "no" },
        ]},
        { id: "f7", name: "contacto", label: "Teléfono de contacto durante la salida", type: "tel", required: true, width: "half" },
        { id: "f8", name: "firma", label: "Firma del acudiente", type: "signature", required: true, width: "full" },
      ]),
      successMessage: "Permiso registrado. El coordinador revisará la solicitud en las próximas 2 horas.",
      errorMessage: "No se pudo registrar el permiso. Verifique los campos obligatorios.",
      published: true,
      publishedAt: new Date(),
      publishedById: rector.id,
      status: "published",
      visibleRolesJson: JSON.stringify(["director_grupo", "coordinador", "rector", "acudiente", "administrativo"]),
      canCreateRolesJson: JSON.stringify(["director_grupo", "coordinador", "acudiente"]),
      canEditRolesJson: JSON.stringify(["coordinador", "rector"]),
      canDeleteRolesJson: JSON.stringify(["rector", "administrativo"]),
    },
  });

  // Módulo 2: Solicitud de cita con orientación
  const mod2 = await db.customModule.create({
    data: {
      institutionId: inst.id,
      createdById: administrativo.id,
      name: "Solicitud de cita con orientación",
      slug: "cita_orientacion",
      description: "Solicite una cita con el departamento de orientación escolar para atención individual o grupal.",
      icon: "HeartHandshake",
      area: "Convivencia",
      menuLabel: "Cita con orientación",
      tabOrientation: "vertical",
      tabLabelsJson: JSON.stringify(["Citas solicitadas", "Solicitar cita"]),
      fieldsJson: JSON.stringify([
        { id: "c1", name: "solicitante", label: "Solicita la cita", type: "radio", required: true, width: "full", options: [
          { label: "Estudiante", value: "estudiante" },
          { label: "Acudiente", value: "acudiente" },
          { label: "Docente", value: "docente" },
          { label: "Directivo", value: "directivo" },
        ]},
        { id: "c2", name: "estudiante", label: "Estudiante involucrado", type: "student", required: true, width: "full", helpText: "Estudiante que recibirá la atención." },
        { id: "c3", name: "modalidad", label: "Modalidad", type: "radio", required: true, width: "half", options: [
          { label: "Individual", value: "individual" },
          { label: "Grupal", value: "grupal" },
          { label: "Familiar", value: "familiar" },
        ]},
        { id: "c4", name: "urgencia", label: "Nivel de urgencia", type: "rating", required: true, width: "half", max: 5, helpText: "1 = baja · 5 = crítica" },
        { id: "c5", name: "motivo", label: "Motivo de la cita", type: "select", required: true, width: "full", options: [
          { label: "Dificultades académicas", value: "academicas" },
          { label: "Manejo de emociones", value: "emociones" },
          { label: "Conflicto con pares", value: "conflicto" },
          { label: "Proceso de inclusión", value: "inclusion" },
          { label: "Charla sobre hábitos", value: "habitos" },
          { label: "Otro", value: "otro" },
        ]},
        { id: "c6", name: "descripcion", label: "Descripción detallada", type: "textarea", required: true, width: "full", rows: 4, placeholder: "Cuéntenos brevemente la situación que requiere atención." },
        { id: "c7", name: "preferencia_horaria", label: "Preferencia horaria", type: "checkbox", required: false, width: "full", options: [
          { label: "Mañana (7-10am)", value: "manana" },
          { label: "Mediodía (10am-12pm)", value: "mediodia" },
          { label: "Tarde (12-2pm)", value: "tarde" },
          { label: "Tarde tardía (2-4pm)", value: "tarde_tardia" },
        ]},
        { id: "c8", name: "contacto", label: "Teléfono de contacto", type: "tel", required: true, width: "half" },
        { id: "c9", name: "email", label: "Correo electrónico", type: "email", required: false, width: "half" },
      ]),
      successMessage: "Solicitud recibida. Orientación escolar confirmará la cita en un máximo de 24 horas hábiles.",
      errorMessage: "No se pudo registrar la solicitud. Verifique los datos.",
      published: true,
      publishedAt: new Date(),
      publishedById: rector.id,
      status: "published",
      visibleRolesJson: JSON.stringify(["docente", "director_grupo", "coordinador", "rector", "orientador", "acudiente", "administrativo"]),
      canCreateRolesJson: JSON.stringify(["docente", "director_grupo", "coordinador", "acudiente"]),
      canEditRolesJson: JSON.stringify(["orientador", "coordinador", "rector"]),
      canDeleteRolesJson: JSON.stringify(["rector", "administrativo"]),
    },
  });

  // Crear algunos registros demo para el módulo 2
  const someStudents = await db.student.findMany({ where: { institutionId: inst.id }, take: 6 });
  const someUsers = [docente, director, acudiente, coordinador];
  const motivosData = [
    { descripcion: "El estudiante presenta dificultades para concentrarse en clase y necesita apoyo.", motivo: "academicas", urgencia: 3 },
    { descripcion: "Solicitamos acompañamiento por conflicto reciente con compañeros.", motivo: "conflicto", urgencia: 4 },
    { descripcion: "Charla grupal sobre manejo de emociones para el grupo 8°A.", motivo: "habitos", urgencia: 2 },
    { descripcion: "Atención individual por situación familiar compleja.", motivo: "emociones", urgencia: 5 },
    { descripcion: "Evaluación de proceso de inclusión y ajustes pedagógicos.", motivo: "inclusion", urgencia: 3 },
  ];
  for (let i = 0; i < motivosData.length; i++) {
    const m = motivosData[i];
    const s = someStudents[i % someStudents.length];
    const u = someUsers[i % someUsers.length];
    await db.customModuleRecord.create({
      data: {
        moduleId: mod2.id,
        institutionId: inst.id,
        userId: u.id,
        dataJson: JSON.stringify({
          c1: i % 2 === 0 ? "docente" : "acudiente",
          c2: s.id,
          c3: i === 2 ? "grupal" : "individual",
          c4: m.urgencia,
          c5: m.motivo,
          c6: m.descripcion,
          c7: i % 2 === 0 ? ["manana"] : ["tarde"],
          c8: u.phone || "+57 300 000 0000",
          c9: u.email || "",
        }),
        status: i < 2 ? "approved" : i === 2 ? "reviewed" : "submitted",
        reviewedById: i < 2 ? orientador.id : null,
        reviewedAt: i < 2 ? new Date(Date.now() - i * 86400000) : null,
      },
    });
  }

  // Crear 3 registros demo para el módulo 1
  for (let i = 0; i < 3; i++) {
    const s = someStudents[i];
    await db.customModuleRecord.create({
      data: {
        moduleId: mod1.id,
        institutionId: inst.id,
        userId: acudiente.id,
        dataJson: JSON.stringify({
          f1: s.id,
          f2: new Date(Date.now() + (i + 1) * 86400000).toISOString().slice(0, 10),
          f3: ["cita_medica", "calamidad", "tramite"][i],
          f4: acudiente.fullName,
          f5: ["Cita con odontólogo a las 2pm.", "Calamidad doméstica, requiere acompañar a familiar.", "Trámite de documento en notaría."][i],
          f6: i === 2 ? "no" : "si",
          f7: acudiente.phone,
          f8: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        }),
        status: i === 0 ? "approved" : "submitted",
      },
    });
  }

  console.log("→ Creando auditoría inicial...");
  await db.auditLog.create({
    data: {
      institutionId: inst.id,
      userId: rector.id,
      action: "system_seed",
      module: "system",
      entityType: "Institution",
      entityId: inst.id,
      details: "Seed inicial de datos de demostración.",
      hash: crypto.randomBytes(16).toString("hex"),
    },
  })

  console.log("\n✅ Seed completo.")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
  console.log("Credenciales de acceso:")
  console.log("  ▸ Rector / Admin: 1155218177 / 1155218177")
  console.log("  ▸ Coordinador:    coordinacion / aulnea123")
  console.log("  ▸ Director grupo: director / aulnea123")
  console.log("  ▸ Docente:        docente / aulnea123")
  console.log("  ▸ Orientador:     orientacion / aulnea123")
  console.log("  ▸ Acudiente:      acudiente / aulnea123")
  console.log("  ▸ Administrativo: administrativo / aulnea123")
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
