"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/store/auth-store";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnrollmentTab } from "./tabs/enrollment-tab";
import { PersonalInfoTab } from "./tabs/personal-info-tab";
import { FilesTab } from "./tabs/files-tab";
import { ContactsTab } from "./tabs/contacts-tab";
import { RequirementsTab } from "./tabs/requirements-tab";
import { CertificatesTab } from "./tabs/certificates-tab";
import { GradesTab } from "./tabs/grades-tab";
import { CoexistenceTab } from "./tabs/coexistence-tab";

export interface StudentRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  firstName2?: string | null;
  lastName2?: string | null;
  status: string;
  birthDate?: string | null;
  gender?: string | null;
  address?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  guardianRelation?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  birthPlace?: string | null;
  baptized?: boolean | null;
  overage?: boolean | null;
  photoUrl?: string | null;
  identityDocUrl?: string | null;
  simatEstrato?: string | null;
  simatEps?: string | null;
  simatMunicipioExp?: string | null;
  group?: { id: string; name: string; branch?: { id: string; name: string } | null } | null;
}

function calcAge(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function StudentDetailView({
  student,
  yearId,
  onBack,
}: {
  student: StudentRow;
  yearId: string;
  onBack: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const age = useMemo(() => calcAge(student.birthDate), [student.birthDate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="space-y-6"
    >
      <Button variant="ghost" className="gap-2 -ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Button>

      {/* Header fijo del estudiante (PDF págs 1-2): avatar, nombre, T.I., nacimiento + edad, acudiente */}
      <div className="hairline rounded-xl bg-card p-4 flex flex-wrap items-center gap-4">
        {student.photoUrl ? (
          <img
            src={student.photoUrl}
            alt={`${student.firstName} ${student.lastName}`}
            className="h-16 w-16 rounded-full object-cover hairline"
          />
        ) : (
          <div className="h-16 w-16 rounded-full bg-secondary grid place-items-center text-muted-foreground hairline">
            <Users className="h-7 w-7" />
          </div>
        )}
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-xl font-heading font-semibold tracking-tight">
            {student.firstName} {student.lastName}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {student.documentType === "CC" ? "C.C." : student.documentType === "CE" ? "C.E." : student.documentType === "PE" ? "P.E." : student.documentType === "RC" ? "R.C." : "T.I."}:
              </span>{" "}
              {student.documentNumber ?? "—"}
            </span>
            <span>
              <span className="font-medium text-foreground">Nacimiento:</span>{" "}
              {student.birthDate
                ? `${new Date(student.birthDate).toLocaleDateString("es-CO")}${age !== null ? ` (${age} años)` : ""}`
                : "—"}
            </span>
            <span>
              <span className="font-medium text-foreground">Acudiente:</span>{" "}
              {student.guardianName ?? "—"}
            </span>
          </div>
        </div>
        {student.group?.name && (
          <Badge variant="secondary">{student.group.name}</Badge>
        )}
      </div>

      <Tabs defaultValue="matricula" className="gap-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="matricula">Matrícula</TabsTrigger>
          <TabsTrigger value="informacion">Información personal</TabsTrigger>
          <TabsTrigger value="archivos">Archivos</TabsTrigger>
          <TabsTrigger value="contactos">Contactos</TabsTrigger>
          <TabsTrigger value="requisitos">Requisitos pendientes</TabsTrigger>
          <TabsTrigger value="certificados">Certificados anteriores</TabsTrigger>
          <TabsTrigger value="calificaciones">Calificaciones</TabsTrigger>
          <TabsTrigger value="convivencia">Convivencia</TabsTrigger>
        </TabsList>

        <TabsContent value="matricula">
          <EnrollmentTab student={student} yearId={yearId} onStudentUpdated={() => {}} />
        </TabsContent>
        <TabsContent value="informacion">
          <PersonalInfoTab student={student} />
        </TabsContent>
        <TabsContent value="archivos">
          <FilesTab student={student} />
        </TabsContent>
        <TabsContent value="contactos">
          <ContactsTab student={student} />
        </TabsContent>
        <TabsContent value="requisitos">
          <RequirementsTab student={student} />
        </TabsContent>
        <TabsContent value="certificados">
          <CertificatesTab student={student} />
        </TabsContent>
        <TabsContent value="calificaciones">
          <GradesTab student={student} />
        </TabsContent>
        <TabsContent value="convivencia">
          <CoexistenceTab student={student} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
