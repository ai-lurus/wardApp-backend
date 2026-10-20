import { withTenant } from "../lib/prisma";
import { OperatorStatus, OperatorDocumentType, OperatorLicenseType, Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";

export interface OperatorFilters {
  status?: OperatorStatus;
  available_only?: boolean;
}

export async function getOperators(companyId: string, filters: OperatorFilters) {
  return withTenant(companyId, async (tx) => {
    const where: Prisma.OperatorWhereInput = {
      company_id: companyId,
      deleted_at: null, // Logical deletion filter
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.available_only) {
      where.status = OperatorStatus.disponible;
    }

    return tx.operator.findMany({
      where,
      include: {
        documents: {
          where: { deleted_at: null }
        }
      },
      orderBy: { created_at: "desc" },
    });
  });
}

export async function getOperatorById(companyId: string, id: string) {
  return withTenant(companyId, async (tx) => {
    return tx.operator.findFirst({
      where: {
        id,
        company_id: companyId,
        deleted_at: null
      },
      include: {
        documents: {
          where: { deleted_at: null }
        }
      }
    });
  });
}

export async function createOperator(companyId: string, data: any) {
  return withTenant(companyId, async (tx) => {
    // Check for existing license number
    const existingLicense = await tx.operator.findFirst({
      where: {
        company_id: companyId,
        license_number: data.license_number,
        deleted_at: null
      },
    });

    if (existingLicense) {
      throw new AppError(
        400,
        `El número de licencia ${data.license_number} ya está registrado en la empresa`
      );
    }

    return tx.operator.create({
      data: {
        ...data,
        company_id: companyId,
      },
    });
  });
}

export async function updateOperator(companyId: string, id: string, data: any) {
  return withTenant(companyId, async (tx) => {
    const operator = await tx.operator.findFirst({
      where: { id, company_id: companyId, deleted_at: null },
    });

    if (!operator) {
      throw new AppError(404, "Operador no encontrado o no pertenece a la empresa");
    }

    return tx.operator.update({
      where: { id },
      data,
    });
  });
}

export async function updateOperatorStatus(companyId: string, id: string, newStatus: OperatorStatus) {
  return withTenant(companyId, async (tx) => {
    const operator = await tx.operator.findFirst({
      where: { id, company_id: companyId, deleted_at: null },
    });

    if (!operator) {
      throw new AppError(404, "Operador no encontrado");
    }

    if (operator.status === OperatorStatus.en_viaje && newStatus === OperatorStatus.inactivo) {
      throw new AppError(400, "No se puede desactivar un operador que se encuentra en viaje");
    }

    return tx.operator.update({
      where: { id },
      data: { status: newStatus },
    });
  });
}

export async function deleteOperator(companyId: string, id: string) {
  return withTenant(companyId, async (tx) => {
    const operator = await tx.operator.findFirst({
      where: { id, company_id: companyId, deleted_at: null },
    });

    if (!operator) {
      throw new AppError(404, "Operador no encontrado");
    }

    return tx.operator.update({
      where: { id },
      data: { deleted_at: new Date() },
    });
  });
}

export async function addDocument(companyId: string, operatorId: string, data: { document_type: OperatorDocumentType, file_url: string, expiry_date?: Date }) {
  return withTenant(companyId, async (tx) => {
    const operator = await tx.operator.findFirst({
      where: { id: operatorId, company_id: companyId, deleted_at: null },
    });

    if (!operator) {
      throw new AppError(404, "Operador no encontrado");
    }

    return tx.operatorDocument.create({
      data: {
        operator_id: operatorId,
        document_type: data.document_type,
        file_url: data.file_url,
        expiry_date: data.expiry_date,
      },
    });
  });
}

export async function removeDocument(companyId: string, operatorId: string, documentId: string) {
  return withTenant(companyId, async (tx) => {
    const document = await tx.operatorDocument.findFirst({
      where: {
        id: documentId,
        operator_id: operatorId,
        deleted_at: null,
        operator: { company_id: companyId }
      },
    });

    if (!document) {
      throw new AppError(404, "Documento no encontrado");
    }

    return tx.operatorDocument.update({
      where: { id: documentId },
      data: { deleted_at: new Date() },
    });
  });
}

export async function getExpiringDocumentsAlerts(companyId: string) {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return withTenant(companyId, async (tx) => {
    return tx.operatorDocument.findMany({
      where: {
        operator: { company_id: companyId, deleted_at: null },
        deleted_at: null,
        expiry_date: {
          lte: thirtyDaysFromNow,
          not: null
        },
      },
      include: {
        operator: true
      },
      orderBy: { expiry_date: "asc" },
    });
  });
}
