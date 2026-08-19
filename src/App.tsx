import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  ExternalLink,
  Film,
  Heart,
  Home,
  Layers3,
  Library,
  LoaderCircle,
  Menu,
  MonitorPlay,
  Play,
  RefreshCw,
  Search,
  Star,
  Tv,
  X,
} from "lucide-react";
import { cleanTitle, getApi } from "./api";

type ContentType = "anime" | "donghua" | "comic";
type TargetType = "detail" | "watch" | "read";

type MediaItem = {
  id: string;
  type: ContentType;
  title: string;
  image: string;
  slug: string;
  meta?: string;
  score?: string;
  target?: TargetType;
};

type FavoriteItem = MediaItem & { savedAt: number };

type WatchedMap = Record<string, number>;

type RouteInfo = {
  page: string;
  segments: string[];
  query: URLSearchParams;
  key: string;
};

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string;
};

const TYPE_LABELS: Record<ContentType, string> = {
  anime: "Anime",
  donghua: "Donghua",
  comic: "Comic",
};

const FALLBACK_POSTER =
  "https://otakudesu.blog/wp-content/uploads/2026/01/152472.jpg";

function parseRoute(): RouteInfo {
  const raw = window.location.hash.replace(/^#\/?/, "") || "home";
  const [path, queryString = ""] = raw.split("?");
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  return {
    page: segments[0] || "home",
    segments,
    query: new URLSearchParams(queryString),
    key: raw,
  };
}

function go(path: string): void {
  const next = `#/${path.replace(/^\//, "")}`;
  if (window.location.hash === next) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = next;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function useRoute(): RouteInfo {
  const [route, setRoute] = useState<RouteInfo>(parseRoute);
  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function useRemote<T>(path: string | null): ApiState<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: Boolean(path),
    error: "",
  });

  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: "" });
      return;
    }
    const controller = new AbortController();
    setState({ data: null, loading: true, error: "" });
    getApi<T>(path, controller.signal)
      .then((data) => setState({ data, loading: false, error: "" }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Gagal memuat data";
        setState({ data: null, loading: false, error: message });
      });
    return () => controller.abort();
  }, [path]);

  return state;
}

function normalizeAnime(item: Record<string, unknown>): MediaItem {
  return {
    id: `anime:${String(item.animeId || item.slug || item.title)}`,
    type: "anime",
    title: cleanTitle(String(item.title || "Tanpa judul")),
    image: String(item.poster || FALLBACK_POSTER),
    slug: String(item.animeId || item.slug || ""),
    meta: item.releaseDay
      ? `${String(item.releaseDay)} - Episode ${String(item.episodes || "baru")}`
      : item.episodes
        ? `${String(item.episodes)} episode`
        : String(item.status || item.season || "Anime"),
    score: item.score ? String(item.score) : undefined,
  };
}

function normalizeDonghua(item: Record<string, unknown>): MediaItem {
  const rawTitle = String(item.title || "Tanpa judul");
  const slug = String(item.slug || "");
  const looksLikeEpisode = /episode-\d+/i.test(slug);
  return {
    id: `donghua:${slug || rawTitle}`,
    type: "donghua",
    title: cleanTitle(rawTitle),
    image: String(item.poster || item.thumbnail || FALLBACK_POSTER),
    slug,
    meta: String(item.type || (item.episode ? `Episode ${String(item.episode)}` : "Donghua")),
    target: looksLikeEpisode ? "watch" : "detail",
  };
}

function normalizeComic(item: Record<string, unknown>): MediaItem {
  const chapters = Array.isArray(item.chapters) ? item.chapters : [];
  const latest = chapters[0] as Record<string, unknown> | undefined;
  return {
    id: `comic:${String(item.slug || item.title)}`,
    type: "comic",
    title: cleanTitle(String(item.title || "Tanpa judul")),
    image: String(item.image || item.poster || FALLBACK_POSTER),
    slug: String(item.slug || ""),
    meta: latest?.title ? String(latest.title) : String(item.type || "Comic"),
    score: item.rating ? String(item.rating) : undefined,
  };
}

function itemPath(item: MediaItem): string {
  if (item.target === "read") return `read/${encodeURIComponent(item.slug)}`;
  if (item.target === "watch") return `watch/${item.type}/${encodeURIComponent(item.slug)}`;
  return `detail/${item.type}/${encodeURIComponent(item.slug)}`;
}

function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("ARCHYY STREAM:favorites") || "[]") as FavoriteItem[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("ARCHYY STREAM:favorites", JSON.stringify(favorites));
  }, [favorites]);

  const toggle = (item: MediaItem) => {
    setFavorites((current) => {
      const exists = current.some((favorite) => favorite.id === item.id);
      if (exists) return current.filter((favorite) => favorite.id !== item.id);
      return [{ ...item, savedAt: Date.now() }, ...current];
    });
  };

  return { favorites, toggle };
}

function useWatchProgress() {
  const [watched, setWatched] = useState<WatchedMap>(() => {
    try {
      return JSON.parse(localStorage.getItem("ARCHYY STREAM:watched") || "{}") as WatchedMap;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem("ARCHYY STREAM:watched", JSON.stringify(watched));
  }, [watched]);

  const markWatched = (episodeId: string) => {
    if (!episodeId) return;
    setWatched((current) => (current[episodeId] ? current : { ...current, [episodeId]: Date.now() }));
  };

  const isWatched = (episodeId: string) => Boolean(watched[episodeId]);

  const progressFor = (episodeIds: string[]) => {
    if (!episodeIds.length) return 0;
    const done = episodeIds.filter((id) => watched[id]).length;
    return Math.round((done / episodeIds.length) * 100);
  };

  return { watched, markWatched, isWatched, progressFor };
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <span className="progress-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </span>
  );
}

function ProgressBadge({ percent }: { percent: number }) {
  return <span className="progress-badge">{percent}% ditonton</span>;
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <button
      className={`logo ${inverse ? "logo-inverse" : ""}`}
      onClick={() => go("home")}
      aria-label="Kembali ke beranda ARCHYY STREAM"
    >
      <span className="logo-mark"><Play size={15} fill="currentColor" /></span>
      <span>ARCHYY STREAM</span>
    </button>
  );
}

function Header({ homePage }: { homePage: boolean }) {
  return (
    <header className={`site-header ${homePage ? "site-header-hero" : ""}`}>
      <div className="header-inner">
        <Logo inverse={homePage} />
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <button onClick={() => go("home")}>Home</button>
          <button onClick={() => go("library?type=anime&filter=ongoing")}>Library</button>
          <button onClick={() => go("schedule?type=anime")}>Jadwal</button>
          <button onClick={() => go("favorite")}>Favorite</button>
        </nav>
        <button
          className={`header-search ${homePage ? "header-search-inverse" : ""}`}
          onClick={() => go("search?type=anime")}
          aria-label="Buka pencarian"
        >
          <Search size={19} />
          <span>Cari tontonan</span>
        </button>
      </div>
    </header>
  );
}

const bottomItems = [
  { page: "home", label: "Home", icon: Home, path: "home" },
  { page: "library", label: "Library", icon: Library, path: "library?type=anime&filter=ongoing" },
  { page: "favorite", label: "Favorite", icon: Heart, path: "favorite", special: true },
  { page: "schedule", label: "Jadwal", icon: CalendarDays, path: "schedule?type=anime" },
  { page: "search", label: "Search", icon: Search, path: "search?type=anime" },
];

function BottomNav({ active }: { active: string }) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi mobile">
      {bottomItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.page;
        return (
          <button
            key={item.page}
            className={`${item.special ? "bottom-special" : ""} ${isActive ? "active" : ""}`}
            onClick={() => go(item.path)}
            aria-label={item.label}
          >
            {item.special ? (
              <motion.span
                className="favorite-bubble"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Icon size={25} fill={isActive ? "currentColor" : "none"} />
              </motion.span>
            ) : (
              <Icon size={21} fill={isActive && item.page === "home" ? "currentColor" : "none"} />
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Logo />
        <p>Anime, donghua, dan comic dalam satu ruang yang simpel.</p>
      </div>
      <div className="footer-links">
        <button onClick={() => go("library?type=anime&filter=ongoing")}>Anime</button>
        <button onClick={() => go("library?type=donghua&filter=latest")}>Donghua</button>
        <button onClick={() => go("library?type=comic&filter=latest")}>Comic</button>
      </div>
      <p className="footer-credit">Data disediakan oleh Sanka Vollerei API.</p>
    </footer>
  );
}

function Poster({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={`poster-fallback ${className}`} aria-label={alt}>
        <Film size={34} />
      </span>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function LoadingState({ label = "Menyiapkan koleksi" }: { label?: string }) {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={29} />
      <p>{label}</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="error-state">
      <CircleAlert size={30} />
      <div><strong>Data belum bisa dimuat</strong><p>{message}</p></div>
      <button className="icon-button" onClick={() => window.location.reload()} aria-label="Muat ulang">
        <RefreshCw size={18} />
      </button>
    </div>
  );
}

function TypeTabs({ value, onChange }: { value: ContentType; onChange: (type: ContentType) => void }) {
  return (
    <div className="type-tabs" role="tablist" aria-label="Jenis koleksi">
      {(["anime", "donghua", "comic"] as ContentType[]).map((type) => (
        <button
          key={type}
          className={value === type ? "active" : ""}
          onClick={() => onChange(type)}
          role="tab"
          aria-selected={value === type}
        >
          {type === "anime" && <Tv size={18} />}
          {type === "donghua" && <MonitorPlay size={18} />}
          {type === "comic" && <BookOpen size={18} />}
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-heading">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  );
}

function MediaCard({
  item,
  favorite,
  onToggle,
  index = 0,
  rowCard = false,
  watchPercent,
}: {
  item: MediaItem;
  favorite: boolean;
  onToggle: (item: MediaItem) => void;
  index?: number;
  rowCard?: boolean;
  watchPercent?: number;
}) {
  return (
    <motion.article
      className={`media-card ${rowCard ? "media-card-row" : ""}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.035, 0.24) }}
    >
      <button className="media-main" onClick={() => go(itemPath(item))}>
        <span className="media-image-wrap">
          <Poster src={item.image} alt={item.title} />
          <span className={`type-tag type-${item.type}`}>{TYPE_LABELS[item.type]}</span>
          <span className="play-peek"><Play size={20} fill="currentColor" /></span>
          {typeof watchPercent === "number" && <span className="progress-mini"><span style={{ width: `${watchPercent}%` }} /></span>}
        </span>
        <span className="media-copy">
          <strong>{item.title}</strong>
          <span>{item.meta || TYPE_LABELS[item.type]}</span>
        </span>
      </button>
      <button
        className={`card-favorite ${favorite ? "active" : ""}`}
        onClick={() => onToggle(item)}
        aria-label={favorite ? `Hapus ${item.title} dari favorit` : `Simpan ${item.title} ke favorit`}
      >
        <Heart size={18} fill={favorite ? "currentColor" : "none"} />
      </button>
      {item.score && <span className="score"><Star size={13} fill="currentColor" /> {item.score}</span>}
    </motion.article>
  );
}

function MediaGrid({
  items,
  favorites,
  toggle,
}: {
  items: MediaItem[];
  favorites: FavoriteItem[];
  toggle: (item: MediaItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Layers3 size={44} />
        <h3>Belum ada koleksi</h3>
        <p>Coba kategori atau kata kunci yang berbeda.</p>
      </div>
    );
  }
  const ids = new Set(favorites.map((item) => item.id));
  return (
    <div className="media-grid">
      {items.map((item, index) => (
        <MediaCard key={`${item.id}:${index}`} item={item} favorite={ids.has(item.id)} onToggle={toggle} index={index} />
      ))}
    </div>
  );
}

function MediaRow({
  items,
  favorites,
  toggle,
  progress,
}: {
  items: MediaItem[];
  favorites: FavoriteItem[];
  toggle: (item: MediaItem) => void;
  progress?: ReturnType<typeof useWatchProgress>;
}) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <Layers3 size={44} />
        <h3>Belum ada koleksi</h3>
        <p>Coba kategori atau kata kunci yang berbeda.</p>
      </div>
    );
  }
  const ids = new Set(favorites.map((item) => item.id));
  return (
    <div className="media-row">
      {items.map((item, index) => {
        const percent = progress ? progress.progressFor(Object.keys(progress.watched).filter((id) => id.includes(item.slug))) : undefined;
        return (
          <MediaCard key={`${item.id}:${index}`} item={item} favorite={ids.has(item.id)} onToggle={toggle} index={index} rowCard watchPercent={percent && percent > 0 ? percent : undefined} />
        );
      })}
    </div>
  );
}

function HomePage({ favorites, toggle, progress }: { favorites: FavoriteItem[]; toggle: (item: MediaItem) => void; progress: ReturnType<typeof useWatchProgress> }) {
  const anime = useRemote<Record<string, unknown>>("/anime/home");
  const donghua = useRemote<Record<string, unknown>>("/anime/donghub/home?page=1");
  const comic = useRemote<Record<string, unknown>>("/comic/komikindo/latest/1");

  const animeData = (anime.data?.data || {}) as Record<string, unknown>;
  const donghuaData = (donghua.data?.data || {}) as Record<string, unknown>;
  const ongoing = (animeData.ongoing || {}) as Record<string, unknown>;
  const slider = Array.isArray(donghuaData.slider) ? donghuaData.slider as Record<string, unknown>[] : [];
  const heroRaw = slider[1] || slider[0];
  const hero: MediaItem = heroRaw
    ? normalizeDonghua(heroRaw)
    : {
        id: "anime:enen",
        type: "anime",
        title: "Enen no Shouboutai San no Shou Part 2",
        image: FALLBACK_POSTER,
        slug: "enen-shouboutai-season-3-p2-sub-indo",
        meta: "Anime pilihan",
      };
  const animeItems = (Array.isArray(ongoing.animeList) ? ongoing.animeList : [])
    .slice(0, 12)
    .map((item) => normalizeAnime(item as Record<string, unknown>));
  const donghuaItems = slider.slice(0, 12).map(normalizeDonghua);
  const comicList = Array.isArray(comic.data?.komikList) ? comic.data.komikList as Record<string, unknown>[] : [];
  const comicItems = comicList.slice(0, 12).map(normalizeComic);
  const continueItems = favorites.filter((item) => Object.keys(progress.watched).some((id) => id.includes(item.slug))).slice(0, 12);

  return (
    <main>
      <section className="home-hero netflix-hero">
        <motion.img
          key={hero.image}
          initial={{ scale: 1.08, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          src={hero.image}
          alt=""
          className="hero-background"
        />
        <div className="hero-shade" />
        <div className="hero-grain" />
        <div className="hero-content">
          <motion.span className="hero-badge" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Star size={13} fill="currentColor" /> Sedang disorot
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.55 }}
          >
            {hero.title}
          </motion.h1>
          <motion.div
            className="hero-bottom"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div>
              <p>Nikmati anime, donghua, dan comic subtitle Indonesia tanpa kehilangan alur.</p>
            </div>
            <div className="hero-actions">
              <button className="button button-yellow" onClick={() => go(itemPath(hero))}>
                <Play size={19} fill="currentColor" /> Mulai sekarang
              </button>
              <button className="button button-ghost-light" onClick={() => go("library?type=anime&filter=ongoing")}>
                <Library size={18} /> Buka library
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="home-rows">
        {continueItems.length > 0 && (
          <section className="row-section">
            <SectionHeading title="Lanjutkan Menonton" description="Judul yang baru saja kamu tonton." />
            <MediaRow items={continueItems} favorites={favorites} toggle={toggle} progress={progress} />
          </section>
        )}

        <section className="row-section">
          <SectionHeading
            title="Anime yang sedang jalan"
            description="Episode baru yang layak masuk antreanmu."
            action={<button className="text-link" onClick={() => go("library?type=anime&filter=ongoing")}>Lihat semua <ArrowRight size={17} /></button>}
          />
          {anime.loading ? <LoadingState /> : anime.error ? <ErrorState message={anime.error} /> : <MediaRow items={animeItems} favorites={favorit
