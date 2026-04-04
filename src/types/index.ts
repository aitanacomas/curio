export type Category = 'cafe' | 'restaurant' | 'hotel' | 'attraction' | 'landmark' | 'art' | 'bar' | 'nightlife' | 'nature' | 'neighbourhood' | 'shop' | 'experience' | 'sports' | 'flight' | 'transport' | 'event' | 'beach' | 'food' | 'wellness' | 'street' | 'treats';

export type Tab = 'home' | 'explore' | 'add' | 'saved' | 'profile';

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  placesCount: number;
  followersCount: number;
  followingCount: number;
  countriesCount: number;
  isCreator?: boolean;
  verified?: boolean;
  monthlyEarnings?: number;
  collectionsFollowers?: number;
  avatarPosition?: string;
}

export interface Place {
  id: string;
  name: string;
  category: Category;
  city: string;
  country: string;
  lat: number;
  lng: number;
  image: string;
  description: string;
  savedCount: number;
  postedBy: string;
  postedAt: string;
  tags: string[];
  price?: string;
  bookingAvailable?: boolean;
  rating?: number;
  neighbourhood?: string;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  placeIds: string[];
  coverImage: string;
  description: string;
  isPremium?: boolean;
  price?: number;
  curatorId?: string;
  followerCount?: number;
}

export interface FeedItem {
  id: string;
  userId: string;
  placeId: string;
  placeIds?: string[];
  images: string[];
  caption: string;
  createdAt: string;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  friendsSaved?: string[];
}

export interface AppUser {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  bio: string;
  location: string;
  isDemo: boolean;
  followingCount: number;
}
