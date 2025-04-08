/*
  Warnings:

  - You are about to drop the column `contentSpoiler` on the `media_reviews` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "media_reviews" DROP COLUMN "contentSpoiler",
ADD COLUMN     "containsSpoilers" BOOLEAN NOT NULL DEFAULT false;
