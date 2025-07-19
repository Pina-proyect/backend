import { Injectable } from '@nestjs/common';
import { Creator } from '@prisma/client';

@Injectable()
export class KycProviderService {
  async verifyDocuments(creator: Creator): Promise<'verified' | 'rejected'> {
    await new Promise((r) => setTimeout(r, 2000)); // simula tiempo de análisis

    // lógica simplificada: si DNI termina en par, aprueba
    const dniNum = parseInt(creator.nationalId.slice(-1));
    return dniNum % 2 === 0 ? 'verified' : 'rejected';
  }
}
