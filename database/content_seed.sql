-- Generated snapshot. New/empty databases only; use the import preview for existing databases.
INSERT INTO `events` (`id`, `title`, `venue`, `event_date`, `event_end_date`, `description`, `image_url`, `status`, `created_by`) VALUES
(1, 'Summer Family Day & Kids Carnival', 'Mombasa Mall', '2026-09-05 10:00:00', NULL, 'Join us at the Play-On Kids Zone for free face painting, magic shows, bouncy castles, and local youth music performances.', NULL, 'past', NULL),
(2, 'East African Fashion Pop-up Weekend', 'Mombasa Mall', '2026-09-18 10:00:00', NULL, 'Browse and buy collections from over 15 local and regional designers showcasing custom-made apparel, kaftans, and hand-woven bags.', NULL, 'past', NULL),
(3, 'Swahili Foodie & Spice Market', 'Mombasa Mall', '2026-10-02 10:00:00', NULL, 'Savor authentic coastal dishes, spicy street food, and chef-led cooking demos in our main atrium and food court.', NULL, 'past', NULL),
(4, 'Back-to-School Mega Sale', 'Mombasa Mall', '2026-07-10 10:00:00', NULL, 'Unbeatable discounts on books, stationery, and uniforms across major retail stores.', NULL, 'past', NULL),
(5, 'Mombasa Tech Innovation Night', 'Mombasa Mall', '2026-06-22 10:00:00', NULL, 'Co-hosted by Westerwelle Startup Haus, bringing together over 120 tech developers and startup founders in Mombasa.', NULL, 'past', NULL);

INSERT INTO `blog_posts` (`id`, `title`, `slug`, `excerpt`, `body`, `image_url`, `author`, `published_date`, `status`, `created_by`) VALUES
(1, 'Welcome to Westerwelle Startup Haus Mombasa', 'westerwelle-coworking-launch', 'Discover the newly launched co-working space and tech incubator on the third floor of Mombasa Mall, offering prime office suites, meeting rooms, and startup support.', 'Discover the newly launched co-working space and tech incubator on the third floor of Mombasa Mall, offering prime office suites, meeting rooms, and startup support.', NULL, 'Mombasa Mall Editorial', '2026-08-10', 'published', NULL),
(2, 'Fresh Grocery Shopping Made Easy at Naivas Anchor', 'naivas-grocery-shopping', 'Explore the massive Naivas Supermarket on the ground floor of Mombasa Mall, featuring fresh produce, a bakery, butchery, and a fully-stocked homeware section.', 'Explore the massive Naivas Supermarket on the ground floor of Mombasa Mall, featuring fresh produce, a bakery, butchery, and a fully-stocked homeware section.', NULL, 'Mombasa Mall Editorial', '2026-08-01', 'published', NULL),
(3, 'Planning the Perfect Family Weekend at Play-On Zone', 'family-weekend-play-on', 'From indoor soft playgrounds to child-safe ball pits and interactive crafts, discover why Play-On at Mombasa Mall is the family destination of choice.', 'From indoor soft playgrounds to child-safe ball pits and interactive crafts, discover why Play-On at Mombasa Mall is the family destination of choice.', NULL, 'Mombasa Mall Editorial', '2026-07-22', 'published', NULL),
(4, 'How Digital LED Screens Can Boost Your Brand Exposure', 'boost-brand-led-screens', 'Learn about our dual-sided high-definition digital billboards in the main atrium and food court, and how flexible advertising loops can scale your business.', 'Learn about our dual-sided high-definition digital billboards in the main atrium and food court, and how flexible advertising loops can scale your business.', NULL, 'Mombasa Mall Editorial', '2026-07-08', 'published', NULL);

INSERT INTO `reviews` (`id`, `reviewer_name`, `reviewer_email`, `store_id`, `store_name_typed`, `rating`, `review_text`, `status`, `admin_notes`) VALUES
(1, 'Aisha Omar', NULL, NULL, 'Mombasa Mall', 5, 'Mombasa Mall has completely transformed my shopping routine. Naivas on the ground floor is incredibly convenient, and NCBA bank is right next door.', 'approved', 'Featured customer testimonial'),
(2, 'Peter Mwangi', NULL, NULL, 'Mombasa Mall', 4, 'Basement parking is spacious, safe, and secure. The automated entry ticketer is fast, and security guards are always helpful.', 'approved', 'Featured customer testimonial'),
(3, 'Joy Kerubo', NULL, NULL, 'Mombasa Mall', 5, 'Westerwelle Startup Haus on the third floor is Mombasa''s best coworking incubator! Superfast internet, quiet meeting rooms, and amazing tech events.', 'approved', 'Featured customer testimonial'),
(4, 'Ali Hassan', NULL, NULL, 'Mombasa Mall', 5, 'The food court on the second floor offers a fantastic mix of local Swahili dishes and fast food. Play-On Kids Zone kept my children fully entertained while I shopped.', 'approved', 'Featured customer testimonial'),
(5, 'Fatma', NULL, NULL, 'Mombasa Mall', 5, 'Loved the weekend designer fashion pop-up markets! Got a beautiful local kaftan.', 'approved', 'Published shopper feedback'),
(6, 'Kiprotich', NULL, NULL, 'Mombasa Mall', 5, 'Convenient location in Mwembe Tayari. Very easy to access via public transport or private drive.', 'approved', 'Published shopper feedback'),
(7, 'Emily', NULL, NULL, 'Mombasa Mall', 5, 'Equity Afia Clinic on the ground floor offers quick and affordable checkups. So glad to have it in the mall.', 'approved', 'Published shopper feedback');

INSERT INTO `gallery` (`id`, `title`, `image_url`, `category`, `caption`, `sort_order`) VALUES
(1, 'The mall after dark', '/assets/lifestyle/mall-night.webp', 'spaces', 'The mall after dark', 1),
(2, 'Mombasa from above', '/assets/lifestyle/city-night.webp', 'spaces', 'Mombasa from above', 2),
(3, 'A brighter welcome', '/assets/lifestyle/facade-night.webp', 'spaces', 'A brighter welcome', 3),
(4, 'In the heart of the city', '/assets/lifestyle/mall-day.webp', 'spaces', 'In the heart of the city', 4),
(5, 'Moments together', '/assets/lifestyle/community.webp', 'people', 'Moments together', 5),
(6, 'The people behind your visit', '/assets/lifestyle/team.webp', 'people', 'The people behind your visit', 6),
(7, 'Everyday essentials at Naivas', '/assets/lifestyle/naivas.webp', 'shopping', 'Everyday essentials at Naivas', 7),
(8, 'Discover Rudra', '/assets/lifestyle/rudra.webp', 'shopping', 'Discover Rudra', 8),
(9, 'Inside Grand Computer', '/assets/lifestyle/grand-computer.webp', 'shopping', 'Inside Grand Computer', 9),
(10, 'Fresh finds', '/assets/lifestyle/fresh-market.webp', 'shopping', 'Fresh finds', 10),
(11, 'West 11 lifestyle', '/assets/lifestyle/west-eleven.webp', 'shopping', 'West 11 lifestyle', 11),
(12, 'A moment worth capturing', '/assets/lifestyle/mall-wings.webp', 'spaces', 'A moment worth capturing', 12);
