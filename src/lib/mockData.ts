export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  cover: string;
  genre: string;
  audioUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  cover: string;
  tracks: Track[];
  genre: string;
}

export interface Contact {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  lastSeen: string;
}

const genres = ["Рок", "Поп", "Электроника", "Хип-хоп", "Джаз", "Классика", "Инди", "R&B"];

export const mockTracks: Track[] = [
  { id: "1", title: "Ночной город", artist: "Электронные сны", album: "Неон", duration: 234, cover: "https://picsum.photos/seed/track1/300/300", genre: "Электроника", audioUrl: "" },
  { id: "2", title: "Красная луна", artist: "Тёмная волна", album: "Готика", duration: 198, cover: "https://picsum.photos/seed/track2/300/300", genre: "Рок", audioUrl: "" },
  { id: "3", title: "Цифровой дождь", artist: "Нео Токио", album: "Синтез", duration: 267, cover: "https://picsum.photos/seed/track3/300/300", genre: "Электроника", audioUrl: "" },
  { id: "4", title: "Звёздная пыль", artist: "Космос", album: "Галактика", duration: 312, cover: "https://picsum.photos/seed/track4/300/300", genre: "Инди", audioUrl: "" },
  { id: "5", title: "Пульс", artist: "Бит Мейкер", album: "Ритм", duration: 189, cover: "https://picsum.photos/seed/track5/300/300", genre: "Хип-хоп", audioUrl: "" },
  { id: "6", title: "Мелодия ночи", artist: "Пиано соул", album: "Клавиши", duration: 345, cover: "https://picsum.photos/seed/track6/300/300", genre: "Джаз", audioUrl: "" },
  { id: "7", title: "Вихрь эмоций", artist: "Рок группа", album: "Буря", duration: 276, cover: "https://picsum.photos/seed/track7/300/300", genre: "Рок", audioUrl: "" },
  { id: "8", title: "Сладкий яд", artist: "Поп дивы", album: "Нектар", duration: 213, cover: "https://picsum.photos/seed/track8/300/300", genre: "Поп", audioUrl: "" },
  { id: "9", title: "Бесконечность", artist: "Эмбиент мастер", album: "Космос", duration: 420, cover: "https://picsum.photos/seed/track9/300/300", genre: "Электроника", audioUrl: "" },
  { id: "10", title: "Рассвет", artist: "Пиано соул", album: "Утро", duration: 298, cover: "https://picsum.photos/seed/track10/300/300", genre: "Классика", audioUrl: "" },
  { id: "11", title: "Танцуй со мной", artist: "Диджей Нова", album: "Клуб", duration: 245, cover: "https://picsum.photos/seed/track11/300/300", genre: "Поп", audioUrl: "" },
  { id: "12", title: "Старый винил", artist: "Ретро вейв", album: "80-е", duration: 310, cover: "https://picsum.photos/seed/track12/300/300", genre: "Инди", audioUrl: "" },
  { id: "13", title: "Серпантин", artist: "Бит Мейкер", album: "Флоу", duration: 203, cover: "https://picsum.photos/seed/track13/300/300", genre: "Хип-хоп", audioUrl: "" },
  { id: "14", title: "Зимняя сказка", artist: "Оркестр мечты", album: "Снег", duration: 356, cover: "https://picsum.photos/seed/track14/300/300", genre: "Классика", audioUrl: "" },
  { id: "15", title: "Неоновый свет", artist: "Синти Поп", album: "Город", duration: 228, cover: "https://picsum.photos/seed/track15/300/300", genre: "Электроника", audioUrl: "" },
  { id: "16", title: "Океан", artist: "R&B Султан", album: "Волны", duration: 287, cover: "https://picsum.photos/seed/track16/300/300", genre: "R&B", audioUrl: "" },
];

export const mockPlaylists: Playlist[] = [
  {
    id: "pl1",
    name: "Тёмные мелодии",
    description: "Идеально для ночной атмосферы",
    cover: "https://picsum.photos/seed/pl1/300/300",
    tracks: mockTracks.slice(0, 4),
    genre: "Рок",
  },
  {
    id: "pl2",
    name: "Электронные сны",
    description: "Погружение в мир синтезаторов",
    cover: "https://picsum.photos/seed/pl2/300/300",
    tracks: mockTracks.slice(2, 6),
    genre: "Электроника",
  },
  {
    id: "pl3",
    name: "Утренний кофе",
    description: "Мягкие звуки для начала дня",
    cover: "https://picsum.photos/seed/pl3/300/300",
    tracks: mockTracks.slice(5, 9),
    genre: "Джаз",
  },
  {
    id: "pl4",
    name: "Басс и бит",
    description: "Мощные биты и глубокий бас",
    cover: "https://picsum.photos/seed/pl4/300/300",
    tracks: mockTracks.slice(4, 8),
    genre: "Хип-хоп",
  },
  {
    id: "pl5",
    name: "Поп хиты",
    description: "Лучшие поп-композиции",
    cover: "https://picsum.photos/seed/pl5/300/300",
    tracks: mockTracks.slice(7, 11),
    genre: "Поп",
  },
  {
    id: "pl6",
    name: "Готическая симфония",
    description: "Мрачная и красивая музыка",
    cover: "https://picsum.photos/seed/pl6/300/300",
    tracks: mockTracks.slice(0, 3),
    genre: "Рок",
  },
];

export const mockContacts: Contact[] = [
  { id: "c1", name: "Александр", avatar: "https://picsum.photos/seed/avatar1/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c2", name: "Мария", avatar: "https://picsum.photos/seed/avatar2/100/100", online: true, lastSeen: "Сейчас" },
  { id: "c3", name: "Дмитрий", avatar: "https://picsum.photos/seed/avatar3/100/100", online: false, lastSeen: "2 часа назад" },
  { id: "c4", name: "Елена", avatar: "https://picsum.photos/seed/avatar4/100/100", online: false, lastSeen: "Вчера" },
  { id: "c5", name: "Максим", avatar: "https://picsum.photos/seed/avatar5/100/100", online: true, lastSeen: "Сейчас" },
];

export const genresList = genres;

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function generateToneUrl(frequency: number = 440, duration: number = 1): string {
  // Generate a simple tone as a data URL for demo purposes
  return `data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=`;
}
