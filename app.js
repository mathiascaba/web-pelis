const { API_KEY, API_URL, IMAGE_BASE, BACKDROP_BASE } = CONFIG;

const state = {
  category: "popular",
  genreId: null,
  page: 1,
  query: "",
  totalPages: 1,
};

const elements = {
  grid: document.getElementById("movies-grid"),
  loading: document.getElementById("loading"),
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
  loadGenres();
  loadMovies();
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
    elements.title.textContent = q ? `Resultados para: "${q}"` : CATEGORY_TITLES.popular;
    if (!q) {
      state.category = "popular";
      document.querySelector('[data-category="popular"]').classList.add("active");
      elements.title.textContent = CATEGORY_TITLES.popular;
    }
    await loadMovies();
  });

  elements.searchInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") elements.searchForm.requestSubmit();
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
      document.querySelectorAll(".genre-pill").forEach((p) => p.classList.remove("active"));
      elements.title.textContent = CATEGORY_TITLES[state.category];
      await loadMovies();
    });
  });
}

async function loadGenres() {
  try {
    const data = await request("/genre/movie/list");
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
        elements.title.textContent = state.genreId
          ? `Género: ${pill.textContent}`
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

async function loadMovies() {
  elements.loading.classList.remove("hidden");
  elements.empty.classList.add("hidden");
  elements.grid.innerHTML = "";
  elements.pagination.classList.add("hidden");

  try {
    const { endpoint, params } = buildUrl();
    const data = await request(endpoint, params);
    state.totalPages = data.total_pages || 1;

    if (!data.results || data.results.length === 0) {
      elements.empty.classList.remove("hidden");
      elements.loading.classList.add("hidden");
      return;
    }

    elements.grid.innerHTML = data.results.map(renderCard).join("");
    renderPagination(data.page);
  } catch (err) {
    console.error(err);
    elements.grid.innerHTML = `
      <div class="empty">
        No se pudieron cargar las películas.<br />
        <small>Comprueba que has puesto tu API key de TMDb en <code>config.js</code>.</small>
      </div>`;
  } finally {
    elements.loading.classList.add("hidden");
  }
}

function renderCard(movie) {
  const poster = movie.poster_path
    ? `<img src="${IMAGE_BASE}${movie.poster_path}" alt="${movie.title}" loading="lazy" />`
    : `<div class="poster-fallback">🎬</div>`;
  return `
    <div class="movie-card" data-id="${movie.id}">
      ${poster}
      <span class="rating">★ ${movie.vote_average.toFixed(1)}</span>
      <div class="movie-info">
        <div class="movie-title">${movie.title}</div>
        <div class="movie-meta">${movie.release_date ? movie.release_date.slice(0, 4) : "N/A"}</div>
      </div>
    </div>`;
}

function renderPagination(page) {
  if (state.totalPages > 1) {
    elements.pagination.classList.remove("hidden");
    elements.pageInfo.textContent = `Página ${page} de ${state.totalPages}`;
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

async function openModal(movieId) {
  try {
    const movie = await request(`/movie/${movieId}`, { append_to_response: "videos" });
    const trailer = movie.videos?.results?.find(
      (v) => v.site === "YouTube" && v.type === "Trailer"
    ) || movie.videos?.results?.find((v) => v.site === "YouTube");

    const backdrop = movie.backdrop_path
      ? `url("${BACKDROP_BASE}${movie.backdrop_path}")`
      : "none";

    const genres = movie.genres.map((g) => g.name).join(", ");

    elements.modalContent.innerHTML = `
      <button class="close-btn" id="close-modal">✕</button>
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
            <iframe src="https://www.youtube.com/embed/${trailer.key}" allowfullscreen></iframe>
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

document.addEventListener("DOMContentLoaded", init);