-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: cantina_db
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `discounts`
--

DROP TABLE IF EXISTS `discounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `discounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `discounts`
--

LOCK TABLES `discounts` WRITE;
/*!40000 ALTER TABLE `discounts` DISABLE KEYS */;
INSERT INTO `discounts` VALUES (1,'Bandas/Ballets',100.00,'2026-03-26 17:58:16'),(2,'Promo1',15.00,'2026-03-26 17:58:27');
/*!40000 ALTER TABLE `discounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
INSERT INTO `events` VALUES (1,'Partido vs Rival','2026-03-24','2026-03-24 20:00:00'),(2,'Evento Corporativo','2026-03-31','2026-03-24 20:00:00');
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `payment_method` enum('cash','mercadopago') DEFAULT 'cash',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `discount_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `fk_order_discount` (`discount_id`),
  CONSTRAINT `fk_order_discount` FOREIGN KEY (`discount_id`) REFERENCES `discounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
INSERT INTO `orders` VALUES (4,5,15500.00,'mercadopago','2026-03-26 13:04:17',NULL),(5,4,33500.00,'cash','2026-03-26 13:04:46',NULL),(6,5,17000.00,'mercadopago','2026-03-26 13:05:16',NULL),(7,5,10000.00,'mercadopago','2026-03-26 16:34:40',NULL),(15,1,5500.00,'cash','2026-03-26 18:06:03',NULL),(16,5,0.00,'cash','2026-03-26 18:06:11',1);
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `partner_contributions`
--

DROP TABLE IF EXISTS `partner_contributions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `partner_contributions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `description` text,
  `returned` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `partner_contributions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `partner_contributions`
--

LOCK TABLES `partner_contributions` WRITE;
/*!40000 ALTER TABLE `partner_contributions` DISABLE KEYS */;
INSERT INTO `partner_contributions` VALUES (1,1,77500.00,'Gancho de chorizos',0,'2026-03-26 15:31:24'),(2,1,19200.00,'4 carbones X 4800 c/u',0,'2026-03-26 15:39:40');
/*!40000 ALTER TABLE `partner_contributions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `price_cost` decimal(10,2) NOT NULL DEFAULT '0.00',
  `price_sale` decimal(10,2) NOT NULL DEFAULT '0.00',
  `profit_pct` decimal(6,2) DEFAULT '0.00',
  `image_path` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `stock` int DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES (8,'Choripan',5500.00,8500.00,0.00,'/uploads/prod_1774478745431_788.png','2026-03-25 22:45:45',0),(9,'Hamburguesa completa',1200.00,5500.00,0.00,'/uploads/prod_1774478791469_942.png','2026-03-25 22:46:31',-2),(10,'Empanadas x Unidad',1000.00,2500.00,0.00,'/uploads/prod_1774478828128_109.jpeg','2026-03-25 22:47:08',0),(11,'Vaso Fernet x 1LT',4000.00,10000.00,0.00,'/uploads/prod_1774478905859_875.png','2026-03-25 22:48:25',0),(12,'Vaso Gancia con sprite x 1 LT',2500.00,6500.00,0.00,'/uploads/prod_1774478931052_554.png','2026-03-25 22:48:43',0),(13,'Cerveza Brahma 500cc',1709.00,3500.00,0.00,'/uploads/prod_1774478988355_712.png','2026-03-25 22:49:48',0),(14,'Agua mineral 500cc',434.00,1500.00,0.00,'/uploads/prod_1774479032365_466.png','2026-03-25 22:50:26',0),(15,'Manaos Cola 2.25LTS',1300.00,3500.00,0.00,'/uploads/prod_1774479097009_642.png','2026-03-25 22:51:37',0),(16,'Manaos Pomelo 2.25LTS',1300.00,3500.00,0.00,'/uploads/prod_1774479121206_135.png','2026-03-25 22:52:01',0),(17,'Vino tinto Michel Torino',1700.00,5000.00,0.00,'/uploads/prod_1774479188465_890.png','2026-03-25 22:53:08',0),(18,'Agua saborizada Placer',950.00,2500.00,0.00,'/uploads/prod_1774479261570_399.png','2026-03-25 22:54:21',0),(19,'Coca Cola 1,75LTS',3125.00,6500.00,0.00,'/uploads/prod_1774479348413_0.png','2026-03-25 22:55:48',0),(20,'Sprite 1,75LTS',3125.00,6500.00,0.00,'/uploads/prod_1774479368728_591.png','2026-03-25 22:56:08',0);
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales`
--

DROP TABLE IF EXISTS `sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales` (
  `id` int NOT NULL AUTO_INCREMENT,
  `order_id` int DEFAULT NULL,
  `product_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `event_id` int DEFAULT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `sale_price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `event_id` (`event_id`),
  KEY `user_id` (`user_id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_ibfk_4` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales`
--

LOCK TABLES `sales` WRITE;
/*!40000 ALTER TABLE `sales` DISABLE KEYS */;
INSERT INTO `sales` VALUES (4,4,13,5,NULL,2,3500.00,'2026-03-26 13:04:17'),(5,4,8,5,NULL,1,8500.00,'2026-03-26 13:04:17'),(6,5,10,4,NULL,12,2500.00,'2026-03-26 13:04:46'),(7,5,15,4,NULL,1,3500.00,'2026-03-26 13:04:46'),(8,6,9,5,NULL,1,5500.00,'2026-03-26 13:05:16'),(9,6,11,5,NULL,1,10000.00,'2026-03-26 13:05:16'),(10,6,14,5,NULL,1,1500.00,'2026-03-26 13:05:16'),(11,7,11,5,NULL,1,10000.00,'2026-03-26 16:34:40'),(12,15,9,1,NULL,1,5500.00,'2026-03-26 18:06:03'),(13,16,9,5,NULL,1,5500.00,'2026-03-26 18:06:11');
/*!40000 ALTER TABLE `sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` int NOT NULL DEFAULT '1',
  `cuit` varchar(50) DEFAULT NULL,
  `logo_path` varchar(255) DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `company_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
-- Datos de configuración omitidos para no publicar CUIT ni información productiva.
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tickets_sold`
--

DROP TABLE IF EXISTS `tickets_sold`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tickets_sold` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `dni` varchar(50) NOT NULL,
  `entered` tinyint(1) NOT NULL DEFAULT '0',
  `sold_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `entered_at` timestamp NULL DEFAULT NULL,
  `payment_method` enum('cash','mercadopago') DEFAULT 'cash',
  `ticket_type` enum('anticipada','puerta') DEFAULT 'anticipada',
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_ticket_user` (`user_id`),
  CONSTRAINT `fk_ticket_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tickets_sold`
--

LOCK TABLES `tickets_sold` WRITE;
/*!40000 ALTER TABLE `tickets_sold` DISABLE KEYS */;
-- Datos de entradas omitidos para no publicar nombres ni documentos personales.
/*!40000 ALTER TABLE `tickets_sold` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','seller','puerta') NOT NULL DEFAULT 'seller',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
-- Usuarios y contraseñas omitidos. Se crean mediante secretos del entorno.
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-26 15:56:43
