-- Runs once, on first initialisation of the MySQL data volume.
-- The `wordpress` database and user are created by the image from its env vars;
-- this script adds the second database used by the Node.js exam portal.

CREATE DATABASE IF NOT EXISTS `aft_portal`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'aftportal'@'%' IDENTIFIED BY 'aftportal';
GRANT ALL PRIVILEGES ON `aft_portal`.* TO 'aftportal'@'%';
FLUSH PRIVILEGES;