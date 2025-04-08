import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Reset mocks before each test to ensure test isolation
beforeEach(() => {
  mockReset(prismaMock);
});

export type PrismaMock = DeepMockProxy<PrismaClient>;
