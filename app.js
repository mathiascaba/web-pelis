const { API_KEY, API_URL, IMAGE_BASE, BACKDROP_BASE } = CONFIG;

const state = {
  category: "popular",
  genreId: null,
  page: 1,
  query: "",
  totalPages: 1,
  genreMap: {},
  heroId: null,
};

const elements = {
  grid: document.getElementById("movies-grid"),
  empty: document.getElementById("empty"),
  title: document.getElementById("section-title"),
  searchForm: document.getElementById("search-form"),
  searchInput: document.getElementById("search-input"),
  genreFilters: document.getElementById("genre-filters"),
  pagination: document.getElementById("pagination"),
  pageInfo: document.getElementById("page-info"),
  prevPage: document.getElementById("prev-page"),
  nextPage: document.getElementById("next-page"),
  modal: document.getElementById("modal"),
  modalContent: document.getElementById("modal-content"),
  modalOverlay: document.getElementById("modal-overlay"),
  hero: document.getElementById("hero"),
  heroBackdrop: document.getElementById("hero-backdrop"),
  heroTitle: document.getElementById("hero-title"),
  heroMeta: document.getElementById("hero-meta"),
  heroOverview: document.getElementById("hero-overview"),
  heroMoreBtn: document.getElementById("hero-more-btn"),
  cursorGlow: document.getElementById("cursor-glow"),
  backToTop: document.getElementById("back-to-top"),
};

const CATEGORY_TITLES = {
  popular: "Populares",
  top_rated: "Mejor valoradas",
  now_playing: "En cartelera",
  upcoming: "Próximamente",
};

function init() {
  setupSearch();
  setupTabs();
  setupPagination();
  setupModal();
  setupEffects();
  const genresReady = loadGenres();
  loadHero(genresReady);
  loadMovies(genresReady);
}

async function request(endpoint, params = {}) {
  const url = new URL(`${API_URL}${endpoint}`);
  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "es-ES");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

function setupSearch() {
  elements.searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = elements.searchInput.value.trim();
    state.query = q;
    state.category = "";
    state.genreId = null;
    state.page = 1;
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".genre-pill").forEach((p) => p.classList.remove("active"));
    elements.hero.classList.toggle("hero-hidden", Boolean(q));
    if (q) {
      elements.title.textContent = "Resultados de búsqueda";
    } else {
      state.category = "popular";
      document.querySelector('[data-category="popular"]').classList.add("active");
      elements.hero.classList.remove("hero-hidden");
      elements.title.textContent = CATEGORY_TITLES.popular;
    }
    await loadMovies();
  });
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.category = tab.dataset.category;
      state.query = "";
      state.genreId = null;
      state.page = 1;
      elements.searchInput.value = "";
      elements.hero.classList.remove("hero-hidden");
      document.querySelectorAll(".genre-pill").forEach((p) => p.classList.remove("active"));
      elements.title.textContent = CATEGORY_TITLES[state.category];
      await loadMovies();
    });
  });
}

async function loadGenres() {
  try {
    const data = await request("/genre/movie/list");
    data.genres.forEach((g) => (state.genreMap[g.id] = g.name));
    elements.genreFilters.innerHTML = data.genres
      .map((g) => `<button class="genre-pill" data-genre-id="${g.id}">${g.name}</button>`)
      .join("");
    elements.genreFilters.querySelectorAll(".genre-pill").forEach((pill) => {
      pill.addEventListener("click", async () => {
        const wasActive = pill.classList.contains("active");
        document.querySelectorAll(".genre-pill").forEach((p) => p.classList.remove("active"));
        state.genreId = wasActive ? null : Number(pill.dataset.genreId);
        if (state.genreId) pill.classList.add("active");
        state.page = 1;
        state.query = "";
        elements.hero.classList.remove("hero-hidden");
        elements.title.textContent = state.genreId
          ? state.genreMap[state.genreId]
          : CATEGORY_TITLES[state.category];
        await loadMovies();
      });
    });
  } catch (err) {
    console.error("Error cargando géneros:", err);
  }
}

function buildUrl() {
  const params = { page: state.page };
  if (state.query) {
    params.query = state.query;
    return { endpoint: "/search/movie", params };
  }
  if (state.genreId) {
    params.with_genres = state.genreId;
    return { endpoint: "/discover/movie", params };
  }
  return {
    endpoint: state.category === "popular" ? "/movie/popular" : `/movie/${state.category}`,
    params,
  };
}

async function loadMovies(genresReady) {
  elements.empty.classList.add("hidden");
  elements.pagination.classList.add("hidden");
  elements.grid.innerHTML = renderSkeletons(12);

  try {
    await genresReady;
    const { endpoint, params } = buildUrl();
    const data = await request(endpoint, params);
    state.totalPages = data.total_pages || 1;
    const results = data.results || [];

    if (results.length === 0) {
      elements.grid.innerHTML = "";
      elements.empty.classList.remove("hidden");
      return;
    }

    elements.grid.innerHTML = results.map(renderCard).join("");
    renderPagination(data.page);
    observeReveals(elements.grid);
  } catch (err) {
    console.error(err);
    elements.grid.innerHTML = `
      <div class="empty" style="grid-column: 1 / -1;">
        <span class="empty-icon">✦</span>
        <p>No se pudieron cargar las películas.</p>
        <small style="color: var(--text-muted);">Comprueba que el TMDB_API_KEY está definido en Vercel.</small>
      </div>`;
  }
}

function renderSkeletons(n) {
  return Array.from({ length: n }, () => `
    <div class="skeleton" aria-hidden="true">
      <div class="skeleton-poster"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>`).join("");
}

function renderCard(movie) {
  const hasPoster = Boolean(movie.poster_path);
  const genres = (movie.genre_ids || [])
    .map((id) => state.genreMap[id])
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
  const backdropVar = movie.backdrop_path
    ? `--backdrop:url("${BACKDROP_BASE}${movie.backdrop_path}")`
    : "";
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "Sin fecha";
  return `
    <article class="movie-card" data-id="${movie.id}" data-reveal style="${backdropVar}">
      <div class="card-backdrop"></div>
      <div class="poster">
        <div class="poster-fallback"><span>▮</span></div>
        ${hasPoster ? `<img src="${IMAGE_BASE}${movie.poster_path}" alt="${movie.title}" loading="lazy" onerror="this.remove()" />` : ""}
      </div>
      <span class="rating">★ ${movie.vote_average.toFixed(1)}</span>
      <div class="movie-info">
        <div class="movie-title">${movie.title}</div>
        <div class="movie-meta">${year}${genres ? ` &middot; ${genres}` : ""}</div>
      </div>
    </article>`;
}

function renderPagination(page) {
  if (state.totalPages > 1) {
    elements.pagination.classList.remove("hidden");
    elements.pageInfo.textContent = `${page} / ${state.totalPages}`;
    elements.prevPage.disabled = page <= 1;
    elements.nextPage.disabled = page >= state.totalPages;
  }
}

function setupPagination() {
  elements.prevPage.addEventListener("click", async () => {
    if (state.page > 1) {
      state.page -= 1;
      await loadMovies();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  elements.nextPage.addEventListener("click", async () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      await loadMovies();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
}

function setupModal() {
  elements.grid.addEventListener("click", (e) => {
    const card = e.target.closest(".movie-card");
    if (card) openModal(card.dataset.id);
  });
  elements.modalOverlay.addEventListener("click", closeModal);
  elements.heroMoreBtn.addEventListener("click", () => {
    if (state.heroId) openModal(state.heroId);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

async function openModal(movieId) {
  try {
    const movie = await request(`/movie/${movieId}`, { append_to_response: "videos" });
    const trailer =
      movie.videos?.results?.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
      movie.videos?.results?.find((v) => v.site === "YouTube");

    const backdrop = movie.backdrop_path
      ? `url("${BACKDROP_BASE}${movie.backdrop_path}")`
      : "none";
    const genres = movie.genres.map((g) => g.name).join(", ");

    elements.modalContent.innerHTML = `
      <button class="close-btn" id="close-modal" aria-label="Cerrar">✕</button>
      <div class="modal-backdrop" style="background-image: ${backdrop};"></div>
      <div class="modal-body">
        <h2 class="modal-title">${movie.title}</h2>
        <p class="modal-tagline">${movie.tagline || ""}</p>
        <div class="modal-summary">
          <p><span class="label">Estreno:</span> ${movie.release_date || "N/A"}</p>
          <p><span class="label">Duración:</span> ${movie.runtime ? movie.runtime + " min" : "N/A"}</p>
          <p><span class="label">Géneros:</span> ${genres}</p>
          <p><span class="label">Valoración:</span> ★ ${movie.vote_average.toFixed(1)} / 10</p>
        </div>
        <p class="overview">${movie.overview || "Sin descripción disponible."}</p>
        ${trailer ? `<button class="trailer-btn" id="play-trailer">▶ Ver trailer</button>` : ""}
        <div id="trailer-container"></div>
      </div>`;

    elements.modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    document.getElementById("close-modal").addEventListener("click", closeModal);
    const playBtn = document.getElementById("play-trailer");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        document.getElementById("trailer-container").innerHTML = `
          <div class="trailer-embed">
            <iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen title="Trailer"></iframe>
          </div>`;
        playBtn.remove();
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function closeModal() {
  elements.modal.classList.add("hidden");
  elements.modalContent.innerHTML = "";
  document.body.style.overflow = "";
}

async function loadHero(genresReady) {
  try {
    await genresReady;
    const data = await request("/movie/popular", { page: 1 });
    const featured = data.results.find((m) => m.backdrop_path) || data.results[0];
    if (!featured) return;
    state.heroId = featured.id;
    elements.heroBackdrop.style.backgroundImage = `url("${BACKDROP_BASE}${featured.backdrop_path}")`;
    elements.heroTitle.textContent = featured.title;
    const genres = (featured.genre_ids || [])
      .map((id) => state.genreMap[id])
      .filter(Boolean)
      .join(" · ");
    const year = featured.release_date ? featured.release_date.slice(0, 4) : "Sin fecha";
    elements.heroMeta.textContent = `${year} · ${genres} · ★ ${featured.vote_average.toFixed(1)}`;
    elements.heroOverview.textContent = featured.overview || "";
  } catch (err) {
    console.error("Error cargando héroe:", err);
  }
}

function setupEffects() {
  const revealAll = () => {
    document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("revealed"));
  };
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.06 }
  );
  window._revealObserver = observer;
  window.setTimeout(revealAll, 3000);

  document.addEventListener("mousemove", (e) => {
    elements.cursorGlow.style.transform = `translate3d(${e.clientX - 150}px, ${e.clientY - 150}px, 0)`;
  });

  window.addEventListener("scroll", () => {
    elements.backToTop.classList.toggle("hidden", window.scrollY < 600);
  });

  elements.backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function observeReveals(container) {
  container.querySelectorAll("[data-reveal]").forEach((el) => {
    el.classList.remove("revealed");
    window._revealObserver.unobserve(el);
    window._revealObserver.observe(el);
  });
}

document.addEventListener("DOMContentLoaded", init);