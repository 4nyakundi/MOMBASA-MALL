// js/seed-data.js
// Seeds existing JSON datasets into Firestore collections without data loss.

import { db } from './firebase-config.js';
import { 
  collection, 
  doc, 
  setDoc, 
  writeBatch, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export async function seedFirestoreDatabase(onProgress = console.log) {
  onProgress('Starting Firestore data migration from JSON sources...');
  
  // Helper to fetch local JSON
  async function loadJson(url) {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      console.warn('Could not load ' + url, e);
      return null;
    }
  }

  // 1. Seed Shops
  onProgress('Loading shops from stores.json...');
  const storesData = await loadJson('../json/stores.json') || await loadJson('./json/stores.json');
  if (storesData && storesData.floors) {
    let shopCount = 0;
    const batch = writeBatch(db);
    
    storesData.floors.forEach(floor => {
      floor.shops.forEach(shop => {
        // Generate a stable ID from room or name
        const docId = (shop.room ? shop.room.toLowerCase().replace(/[^a-z0-9]/g, '-') : shop.name.toLowerCase().replace(/[^a-z0-9]/g, '-')) || `shop-${Math.random().toString(36).substr(2, 6)}`;
        const shopRef = doc(db, 'shops', docId);
        
        batch.set(shopRef, {
          name: shop.name || 'Store Name',
          category: shop.category || 'retail',
          floor: floor.name || 'Ground Floor',
          room: shop.room || '',
          description: shop.description || '',
          phone: shop.phone || '+254 790 964 002',
          email: shop.email || 'info@mombasamall.co.ke',
          socialHandle: shop.social || '@mombasamall',
          logoUrl: shop.logo || './assets/Logo/Mall Logo/MOMBASA MALL 1.0.png',
          photoUrls: shop.photoUrls || [],
          isActive: true,
          createdAt: new Date().toISOString()
        }, { merge: true });
        
        shopCount++;
      });
    });
    
    await batch.commit();
    onProgress(`✅ Successfully seeded ${shopCount} shops into 'shops' collection.`);
  }

  // 2. Seed Events
  onProgress('Loading events from events.json...');
  const eventsData = await loadJson('../json/events.json') || await loadJson('./json/events.json');
  if (eventsData) {
    const batch = writeBatch(db);
    let eventCount = 0;
    
    (eventsData.upcoming || []).forEach(evt => {
      const docId = 'up-' + (evt.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30));
      const ref = doc(db, 'events', docId);
      batch.set(ref, {
        title: evt.title,
        date: evt.date,
        summary: evt.summary || '',
        type: 'upcoming',
        imageUrl: evt.imageUrl || './assets/Logo/Random pics/events - Copy.jpeg',
        createdAt: new Date().toISOString()
      }, { merge: true });
      eventCount++;
    });

    (eventsData.past || []).forEach(evt => {
      const docId = 'past-' + (evt.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30));
      const ref = doc(db, 'events', docId);
      batch.set(ref, {
        title: evt.title,
        date: evt.date,
        summary: evt.summary || '',
        type: 'past',
        imageUrl: evt.imageUrl || './assets/Logo/Random pics/events - Copy.jpeg',
        createdAt: new Date().toISOString()
      }, { merge: true });
      eventCount++;
    });

    await batch.commit();
    onProgress(`✅ Successfully seeded ${eventCount} events into 'events' collection.`);
  }

  // 3. Seed Blog Posts
  onProgress('Loading blog posts from blog.json...');
  const blogData = await loadJson('../json/blog.json') || await loadJson('./json/blog.json');
  if (blogData && blogData.posts) {
    const batch = writeBatch(db);
    let blogCount = 0;
    
    blogData.posts.forEach(post => {
      const docId = post.slug || post.title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
      const ref = doc(db, 'blogPosts', docId);
      batch.set(ref, {
        title: post.title,
        date: post.date || new Date().toISOString().slice(0, 10),
        excerpt: post.excerpt || '',
        content: post.content || post.excerpt || '',
        slug: post.slug || docId,
        imageUrl: post.imageUrl || './assets/Logo/Random pics/MOMBASA MALL.jpg',
        createdAt: new Date().toISOString()
      }, { merge: true });
      blogCount++;
    });
    
    await batch.commit();
    onProgress(`✅ Successfully seeded ${blogCount} blog posts into 'blogPosts' collection.`);
  }

  // 4. Seed Reviews (all set approved: true by default during seed)
  onProgress('Loading reviews from reviews.json...');
  const reviewsData = await loadJson('../json/reviews.json') || await loadJson('./json/reviews.json');
  if (reviewsData) {
    const batch = writeBatch(db);
    let reviewCount = 0;
    
    (reviewsData.testimonials || []).forEach((t, idx) => {
      const docId = 'testi-' + (t.author.toLowerCase().replace(/[^a-z0-9]/g, '-') || idx);
      const ref = doc(db, 'reviews', docId);
      batch.set(ref, {
        author: t.author,
        quote: t.quote,
        rating: t.rating || 5,
        type: 'testimonial',
        approved: true,
        createdAt: new Date().toISOString()
      }, { merge: true });
      reviewCount++;
    });

    (reviewsData.customerFeedback || []).forEach((f, idx) => {
      const docId = 'feed-' + (f.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || idx);
      const ref = doc(db, 'reviews', docId);
      batch.set(ref, {
        author: f.name,
        quote: f.comment,
        rating: 5,
        type: 'feedback',
        approved: true,
        createdAt: new Date().toISOString()
      }, { merge: true });
      reviewCount++;
    });

    await batch.commit();
    onProgress(`✅ Successfully seeded ${reviewCount} reviews into 'reviews' collection.`);
  }

  // 5. Seed Gallery Photos
  onProgress('Seeding initial photo albums into gallery collection...');
  const defaultGallery = [
    { imageUrl: './assets/Logo/Random pics/MOMBASA MALL.jpg', caption: 'Mombasa Mall Exterior Facade & Architecture', category: 'architecture', sortOrder: 1 },
    { imageUrl: './assets/Logo/Random pics/events - Copy.jpeg', caption: 'Central Atrium Events & Weekend Markets', category: 'events', sortOrder: 2 },
    { imageUrl: './assets/Logo/Random pics/Staff.jpeg', caption: 'Mall Management, Customer Service & Hospitality', category: 'community', sortOrder: 3 },
    { imageUrl: './assets/Logo/Random pics/fruits and vegetabls.jpeg', caption: 'Naivas 24/7 Organic Fresh Produce', category: 'retail', sortOrder: 4 },
    { imageUrl: './assets/Logo/Random pics/Rounder about.jpeg', caption: 'Panoramic Mwembe Tayari Roundabout View', category: 'architecture', sortOrder: 5 },
    { imageUrl: './assets/Logo/Shops Logo/Naivasmain.jpeg', caption: 'Naivas Supermarket Entrance', category: 'retail', sortOrder: 6 },
    { imageUrl: './assets/Logo/Shops Logo/West 11.jpg', caption: 'West 11 Flagship Fashion & Lifestyle', category: 'retail', sortOrder: 7 },
    { imageUrl: './assets/Logo/Shops Logo/Payless.jpg', caption: 'Payless Shoes Family Footwear Store', category: 'retail', sortOrder: 8 }
  ];

  const galleryBatch = writeBatch(db);
  defaultGallery.forEach((item, index) => {
    const docId = `gallery-${index + 1}`;
    const ref = doc(db, 'gallery', docId);
    galleryBatch.set(ref, {
      imageUrl: item.imageUrl,
      caption: item.caption,
      category: item.category,
      sortOrder: item.sortOrder,
      uploadedAt: new Date().toISOString()
    }, { merge: true });
  });
  await galleryBatch.commit();
  onProgress(`✅ Successfully seeded ${defaultGallery.length} photos into 'gallery' collection.`);

  // 6. Seed Singleton siteContent
  onProgress('Seeding homepage singleton content into siteContent...');
  const siteData = await loadJson('../json/site-data.json') || await loadJson('./json/site-data.json') || {};
  const homepageRef = doc(db, 'siteContent', 'homepage');
  await setDoc(homepageRef, {
    siteName: siteData.siteName || "Mombasa Mall",
    tagline: siteData.tagline || "The Coastal Luxury Flagship",
    description: siteData.description || "Mombasa Mall is the premier shopping, dining, and lifestyle destination in the heart of Mombasa. Retail, dining, entertainment, and events across 5 floors.",
    heroHeading: "Where Retail Meets The Indian Ocean.",
    heroSub: "Open Daily · Mwembe Tayari, Mombasa · 5 Floors",
    marqueeItems: [
      "The Coastal Lifestyle",
      "Premium Shopping",
      "Mombasa's Landmark",
      "120+ Brands",
      "5 Floors of Possibility"
    ],
    address: siteData.address || "Mombasa Mall, Jomo Kenyatta Avenue, Mwembe Tayari, Mombasa, Kenya",
    phone: siteData.phone || "+254 790 964 002",
    email: siteData.email || "info@mombasamall.co.ke",
    openingHours: siteData.openingHours || "Open 24/7",
    social: siteData.social || {
      facebook: "https://facebook.com/mombasamall",
      instagram: "https://instagram.com/mombasamall",
      twitter: "https://twitter.com/mombasamall"
    },
    updatedAt: new Date().toISOString()
  }, { merge: true });
  onProgress(`✅ Successfully seeded singleton doc 'siteContent/homepage'.`);

  onProgress('🎉 ALL COLLECTIONS SUCCESSFULLY SEEDED IN FIRESTORE!');
  return true;
}
