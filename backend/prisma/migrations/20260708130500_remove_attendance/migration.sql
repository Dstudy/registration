-- DropForeignKey
ALTER TABLE `Attendance` DROP FOREIGN KEY `Attendance_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Attendance` DROP FOREIGN KEY `Attendance_shiftId_fkey`;

-- DropTable
DROP TABLE `Attendance`;
