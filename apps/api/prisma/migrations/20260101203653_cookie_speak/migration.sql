-- AlterTable
ALTER TABLE "VoiceParticipant" ADD COLUMN     "deafened" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "muted" BOOLEAN NOT NULL DEFAULT false;
