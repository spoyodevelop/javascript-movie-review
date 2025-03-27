(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
const Toast = {
  showToast(message, type = "error", duration = 5e3) {
    if (type === "info") duration = 2e3;
    let toastContainer = document.querySelector(
      ".toast-container"
    );
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      document.body.appendChild(toastContainer);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    if (type === "error") {
      message = message.replace("[ERROR]", "");
    }
    toast.innerHTML = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("show");
    }, 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
    toast.addEventListener("click", () => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    });
  },
  resetToast() {
    const toastContainer = document.querySelector(
      ".toast-container"
    );
    if (toastContainer) toastContainer.remove();
  }
};
const URLS = {
  config: "https://api.themoviedb.org/3/configuration",
  popularMovieUrl: "https://api.themoviedb.org/3/movie/popular",
  searchMovieUrl: "https://api.themoviedb.org/3/search/movie",
  detailsMovieUrl: "https://api.themoviedb.org/3/movie"
};
const defaultOptions = {
  headers: {
    Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiNDEwYjgwYTQ3YWZmMWY2N2Y3ZWI4YWRlNDdjNDMzZSIsIm5iZiI6MTc0MjA1NTc0OS44NDYwMDAyLCJzdWIiOiI2N2Q1YTk0NTMxNTM4ZGU2MDhmMTc5MjAiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.VeyCG6Y9nTOdCyVv3vzAUGIJj48idtO9l-c0vdcKBsU"}`
  }
};
const defaultQueryObject = {
  language: "ko-KR",
  include_adult: "false"
};
const TOTAL_PAGE = 500;
const paths = {
  logo: "./images/logo.png",
  search: "./images/Search.png",
  star_empty: "./images/star_empty.png"
};
const ratingMessages = {
  "1": "최악이예요",
  "2": "별로예요",
  "3": "보통이에요",
  "4": "재미있어요",
  "5": "명작이에요"
};
const ratingNumbers = {
  "1": "(2/10)",
  "2": "(4/10)",
  "3": "(6/10)",
  "4": "(8/10)",
  "5": "(10/10)"
};
const defaultRating = 3;
function getPlainQuery(queryObj) {
  return queryObj instanceof URLSearchParams ? Object.fromEntries(queryObj.entries()) : queryObj;
}
function buildQuery(plainQuery, searchTerm, page) {
  return searchTerm ? { query: searchTerm, ...plainQuery, page: String(page) } : { ...plainQuery, page: String(page) };
}
const ERROR_MESSAGE = {
  FETCH_ERROR: "API 서버 상태가 좋지 않아 데이터를 가져오는데 실패했습니다.",
  NO_DATA: "검색 값을 찾지 못했어요.",
  SERVER_ERROR: "서버에서 오류가 발생했습니다. 관리자에게 문의하세요.",
  NETWORK_DISCONNECTED: "인터넷 연결이 끊어졌습니다. 연결을 확인해 주세요."
};
async function fetchUrl(url, queryObject, options = {}, path) {
  function buildMovieUrl(baseUrl, path2, queryObject2 = {}) {
    let url2 = baseUrl;
    if (path2) {
      url2 += `/${path2}`;
    }
    const queryString = new URLSearchParams(queryObject2).toString();
    return queryString ? `${url2}?${queryString}` : url2;
  }
  const finalUrl = buildMovieUrl(url, path, queryObject);
  const controller = new AbortController();
  options.signal = controller.signal;
  try {
    const response = await fetch(finalUrl, options);
    if (!response.ok) {
      throw new Error(ERROR_MESSAGE.SERVER_ERROR);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    if (!navigator.onLine) {
      throw new Error(ERROR_MESSAGE.NETWORK_DISCONNECTED);
    }
    throw new Error(ERROR_MESSAGE.FETCH_ERROR);
  }
}
function validateResponse(response) {
  if (!response || !response.results) {
    throw new Error(ERROR_MESSAGE.FETCH_ERROR);
  }
  if (response.results.length === 0) {
    throw new Error(ERROR_MESSAGE.NO_DATA);
  }
}
async function fetchMovies(url, queryObject, options, onError, path) {
  try {
    const response = await fetchUrl(
      url,
      new URLSearchParams(queryObject),
      options,
      path
    );
    validateResponse(response);
    return response;
  } catch (error) {
    if (onError) {
      onError(error);
    } else {
      throw error;
    }
    return { id: -1, results: [], total_pages: 0, page: 1, total_results: 0 };
  }
}
function createMovieLoader(url, queryObj, options, onError, searchTerm) {
  let page = 1;
  let errorOccurred = false;
  const handleError2 = (error) => {
    errorOccurred = true;
    onError(error);
  };
  return async () => {
    const plainQuery = getPlainQuery(queryObj);
    const queryObject = buildQuery(plainQuery, searchTerm, page);
    const response = await fetchMovies(url, queryObject, options, handleError2);
    if (errorOccurred) {
      errorOccurred = false;
      return { results: response.results, isLastPage: true };
    }
    const { results, total_pages } = response;
    const pageLimit = Math.min(TOTAL_PAGE, total_pages);
    page++;
    return { results, isLastPage: page > pageLimit };
  };
}
function createElement(tag, props = {}) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "className") {
      if (Array.isArray(value)) {
        element.classList.add(...value);
      } else if (typeof value === "string") {
        element.classList.add(value);
      }
      continue;
    }
    if (key in element) {
      element[key] = value;
    }
  }
  return element;
}
function createElementsFragment(elements) {
  const fragment = document.createDocumentFragment();
  fragment.append(...elements);
  return fragment;
}
function handleConnectionError() {
  const $hero = document.getElementById("hero");
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  const $fallback = document.getElementById("fallback");
  const $fallbackDetails = document.getElementById("fallback-details");
  hideElement($hero);
  hideElement($thumbnailContainer);
  showElement($fallback);
  if ($fallbackDetails) {
    $fallbackDetails.innerText = "뭔가 잘못되었어요. 인터넷 상태를 체크하신뒤 세로 고침을 해주세요!";
  }
}
function checkApiAvailability(infiniteScrollInstance2, delay = 3e3, startTime = Date.now()) {
  if (Date.now() - startTime > 6e4) {
    Toast.showToast("최대 대기 시간(1분)을 초과했습니다.", "info", 2e3);
    return;
  }
  setTimeout(() => {
    fetch(URLS.config, {
      ...defaultOptions,
      method: "GET"
    }).then((response) => {
      if (response.ok) {
        if (infiniteScrollInstance2)
          infiniteScrollInstance2.resumeInfiniteScroll();
      } else {
        checkApiAvailability(infiniteScrollInstance2, delay * 2, startTime);
      }
    }).catch(() => {
      Toast.showToast(
        "서버의 상황이 좋지 않아 접속을 다시 시도하고 있어요.... 잠깐 기다려 보세요...",
        "info",
        2e3
      );
      checkApiAvailability(infiniteScrollInstance2, delay * 2, startTime);
    });
  }, delay);
}
let showingItem = "";
let loadMovies = null;
function setShowingItem(value) {
  showingItem = value;
}
function getShowingItem() {
  return showingItem;
}
function setLoadMovies(fn) {
  loadMovies = fn;
}
function getLoadMovies() {
  return loadMovies;
}
async function fetchAndSetLoadingEvent() {
  document.dispatchEvent(new CustomEvent("loading:start"));
  const loadMovies2 = getLoadMovies();
  let data = null;
  if (typeof loadMovies2 === "function") {
    data = await loadMovies2();
  }
  document.dispatchEvent(
    new CustomEvent("loading:end", {
      detail: { isLastPage: (data == null ? void 0 : data.isLastPage) ?? false }
    })
  );
  return data;
}
let isErrorHandled = false;
async function handleSearch(searchValue) {
  isErrorHandled = false;
  setSearchResultTitle(searchValue);
  setSearchLoadingState();
  window.scrollTo({ top: 0, behavior: "smooth" });
  setLoadMovies(
    createMovieLoader(
      URLS.searchMovieUrl,
      defaultQueryObject,
      defaultOptions,
      (error) => handleSearchError(error),
      searchValue
    )
  );
  try {
    const data = await fetchAndSetLoadingEvent();
    if (data && data.results) {
      renderMovieItems(data.results, true);
    }
    displaySearchResults();
    if (infiniteScrollInstance) infiniteScrollInstance.resumeInfiniteScroll();
  } catch (error) {
    return;
  }
}
function setSearchResultTitle(searchValue) {
  const description = document.getElementById("description");
  if (description) {
    description.textContent = `"${searchValue}" 검색 결과`;
  }
}
function setSearchLoadingState() {
  const $fallback = document.getElementById("fallback");
  const $hero = document.getElementById("hero");
  const $thumbnailList = document.getElementById("thumbnail-list");
  hideElement($fallback);
  hideElement($hero);
  hideElement($thumbnailList);
}
function displaySearchResults() {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  const $thumbnailList = document.getElementById("thumbnail-list");
  showElement($thumbnailContainer);
  showElement($thumbnailList);
}
function handleSearchError(error) {
  if (isErrorHandled) return;
  isErrorHandled = true;
  if (error.message !== ERROR_MESSAGE.NO_DATA) {
    Toast.showToast(error.message, "error", 3e3);
    checkApiAvailability(infiniteScrollInstance, 3e3);
  } else {
    if (infiniteScrollInstance) infiniteScrollInstance.stopInfiniteScroll();
    const $thumbnailContainer = document.getElementById("thumbnail-container");
    const $fallback = document.getElementById("fallback");
    const $fallbackDetails = document.getElementById("fallback-details");
    console.log(error);
    Toast.showToast(error.message, "error", 5e3);
    if ($fallbackDetails) $fallbackDetails.innerText = "검색 결과가 없습니다.";
    hideElement($thumbnailContainer);
    showElement($fallback);
  }
}
function Header() {
  const $headerContainer = createElement("div", {
    className: "header-container"
  });
  const $header = createElement("header", { className: "header" });
  const $logo = createElement("h1", { className: "logo", id: "logo" });
  const $logoImg = createElement("img", {
    src: paths.logo,
    alt: "MovieList"
  });
  const $form = createElement("form", {
    className: "input-form"
  });
  const $searchButton = createElement("button", {
    className: "search-btn"
  });
  const $searchImg = createElement("img", {
    src: paths.search,
    alt: "돋보기"
  });
  const $input = createElement("input", {
    type: "text",
    name: "search-bar",
    className: "search-bar",
    placeholder: "검색어를 입력하세요"
  });
  $form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const searchValue = formData.get("search-bar");
    handleSearch(searchValue);
  });
  $logo.addEventListener("click", () => {
    window.scrollTo({ top: 0 });
    location.reload();
  });
  $searchButton.appendChild($searchImg);
  $form.append($input, $searchButton);
  $logo.appendChild($logoImg);
  $header.append($logo, $form);
  $headerContainer.appendChild($header);
  return $headerContainer;
}
function Hero() {
  const backgroundHero = createElement("div", {
    id: "hero",
    className: "background-container"
  });
  backgroundHero.innerHTML = `

    <div class="overlay">
    
    <div class="hero-skeleton" id="hero-skeleton"></div>
    <img id="hero-img" alt="Hero Image" class="hero-img"/>
     <div class="overlay" aria-hidden="true"></div>
      <div class="top-rated-container">
          <div class="top-rated-movie hide" id="top-rated-container">
               <div class="rate">
                 <img src="${paths.star_empty}" class="star" />
                 <span class="rate-value" id="hero-rate"></span>
               </div>
               <div class="title" id="hero-title"></div>
              <button class="primary detail" id="hero-details-button">자세히 보기</button>
            </div>
        </div>
    
    </div>
       
`;
  return backgroundHero;
}
function MovieItem({ id, src, title, rate, onload }) {
  const $li = createElement("li", { id });
  let url = `https://image.tmdb.org/t/p/w500/${src}`;
  if (!src) url = "images/fallback.png";
  $li.innerHTML = `
      <div class="skeleton-thumbnail thumbnail"></div>
      <div class="item">
        <img
          class="thumbnail hide"
          src="${url}"
          alt="${title}"
        />
        <div class="item-desc">
          <p class="rate">
            <img src="./images/star_empty.png" class="star" />
            <span>${Number(rate).toFixed(1)}</span>
          </p>
          <strong>${title}</strong>
        </div>
      </div>
  `;
  if (onload) {
    const img = $li.querySelector("img.thumbnail");
    img.addEventListener("load", onload);
  }
  return $li;
}
function showElement(element) {
  element == null ? void 0 : element.classList.remove("hide");
}
function hideElement(element) {
  element == null ? void 0 : element.classList.add("hide");
}
function hideImgSkeleton(event) {
  var _a, _b;
  const img = event.target;
  if (!img) return;
  showElement(img);
  const skeleton = (_b = (_a = img.parentElement) == null ? void 0 : _a.parentElement) == null ? void 0 : _b.querySelector(
    ".skeleton-thumbnail"
  );
  skeleton == null ? void 0 : skeleton.remove();
}
function renderMovieItems(results, reset) {
  const $list = document.getElementById("thumbnail-list");
  if (reset && $list) $list.innerHTML = "";
  const movieItems = results.map((result) => {
    const { id, title, poster_path, vote_average } = result;
    return MovieItem({
      id,
      title,
      src: poster_path,
      rate: vote_average,
      onload: hideImgSkeleton
    });
  });
  $list == null ? void 0 : $list.appendChild(createElementsFragment(movieItems));
}
function renderHeaderAndHero() {
  const $wrap = document.getElementById("wrap");
  if ($wrap) {
    $wrap.prepend(Header());
    $wrap.prepend(Hero());
  }
}
function updateHero({ poster_path, title, vote_average }) {
  const heroImg = document.getElementById("hero-img");
  const heroTitle = document.getElementById("hero-title");
  const heroAverage = document.getElementById("hero-rate");
  const topRatedContainer = document.getElementById("top-rated-container");
  const heroButton = document.getElementById("hero-details-button");
  let url = `https://image.tmdb.org/t/p/original${poster_path}`;
  if (!poster_path) url = "images/fallback.png";
  if (heroImg) heroImg.src = url;
  const img = document.getElementById("hero-img");
  const heroSkeleton = document.getElementById("hero-skeleton");
  if (img)
    img.addEventListener("load", () => {
      hideElement(heroSkeleton);
      if (heroAverage) heroAverage.innerText = Number(vote_average).toFixed(1);
      if (heroTitle) heroTitle.innerText = title;
      showElement(topRatedContainer);
    });
  const modal = document.getElementById("modal-dialog");
  if (heroButton)
    heroButton.addEventListener("click", () => {
      modal.showModal();
    });
}
function updateDetails({
  poster_path,
  release_date,
  overview,
  title,
  vote_average,
  genres,
  id
}) {
  const detailsImage = document.getElementById(
    "details-image"
  );
  const detailsTitle = document.getElementById("details-title");
  const detailsCategory = document.getElementById(
    "details-category"
  );
  const detailsRate = document.getElementById("details-rate");
  const detailsDescription = document.getElementById(
    "details-description"
  );
  const starRatingDetails = document.getElementById(
    "star-rating-details"
  );
  const starRatingNumbers = document.getElementById(
    "star-rating-numbers"
  );
  const savedRating = localStorage.getItem(String(id));
  if (savedRating) {
    const input = document.querySelector(
      `input[name="star-rating"][value="${savedRating}"]`
    );
    if (input) input.checked = true;
    starRatingDetails.innerText = ratingMessages[savedRating];
    starRatingNumbers.innerText = ratingNumbers[savedRating];
  } else {
    starRatingDetails.innerText = ratingMessages[defaultRating];
    starRatingNumbers.innerText = ratingNumbers[defaultRating];
    document.getElementById("star3").checked = true;
  }
  let categoryNames = "";
  if (genres) {
    categoryNames = `${new Date(release_date).getFullYear()} · ${genres.map((genre) => genre.name).join(", ")} `;
  }
  let imgUrl = "./images/fallback_no_movies.png";
  if (poster_path) {
    imgUrl = `https://image.tmdb.org/t/p/original${poster_path}`;
  }
  detailsTitle.innerText = title;
  detailsRate.innerText = Number(vote_average).toFixed(1);
  detailsCategory.innerText = categoryNames;
  detailsDescription.innerText = overview;
  detailsImage.src = imgUrl;
}
function setupInfiniteScroll() {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  if (!$thumbnailContainer) return;
  const sentinel = document.createElement("div");
  sentinel.id = "infinite-scroll-sentinel";
  $thumbnailContainer.append(sentinel);
  let infiniteScrollSuspended = false;
  const observer = new IntersectionObserver(
    async (entries) => {
      if (infiniteScrollSuspended) return;
      const entry = entries[0];
      if (entry.isIntersecting) {
        observer.unobserve(sentinel);
        const data = await fetchAndSetLoadingEvent();
        if (data == null ? void 0 : data.results) {
          renderMovieItems(data.results, false);
        }
        if (data == null ? void 0 : data.isLastPage) {
          infiniteScrollSuspended = true;
        } else {
          $thumbnailContainer.append(sentinel);
          observer.observe(sentinel);
        }
      }
    },
    {
      root: null,
      threshold: 0.1
    }
  );
  observer.observe(sentinel);
  function resumeInfiniteScroll() {
    if (infiniteScrollSuspended) {
      infiniteScrollSuspended = false;
      if (!document.getElementById("infinite-scroll-sentinel") && $thumbnailContainer) {
        $thumbnailContainer.append(sentinel);
      }
      observer.observe(sentinel);
    }
  }
  function stopInfiniteScroll() {
    if (infiniteScrollSuspended) {
      infiniteScrollSuspended = true;
      if (!document.getElementById("infinite-scroll-sentinel") && $thumbnailContainer) {
        $thumbnailContainer.append(sentinel);
      }
      observer.unobserve(sentinel);
    }
  }
  return { observer, resumeInfiniteScroll, stopInfiniteScroll };
}
async function handleItemClick(id) {
  try {
    const result = await fetchUrl(
      URLS.detailsMovieUrl,
      defaultQueryObject,
      defaultOptions,
      id
    );
    updateDetails(result);
    updateHero(result);
    setShowingItem(id);
    const skeleton = document.getElementById("details-skeleton");
    const detailsImage = document.getElementById("details-image");
    showElement(skeleton);
    hideElement(detailsImage);
    const modal = document.getElementById(
      "modal-dialog"
    );
    if (modal) {
      modal.showModal();
    }
  } catch (error) {
    if (error instanceof Error) Toast.showToast(error.message, "error", 5e3);
  }
}
function bindLoadingEvents() {
  if (!window._loadingEventRegistered) {
    document.addEventListener("loading:start", () => {
      const skeleton = document.querySelector(".skeleton-list");
      const loadMore = document.getElementById("load-more");
      if (skeleton) showElement(skeleton);
      if (loadMore) hideElement(loadMore);
    });
    document.addEventListener("loading:end", (e) => {
      const skeleton = document.querySelector(".skeleton-list");
      const loadMore = document.getElementById("load-more");
      const customEvent = e;
      if (skeleton) hideElement(skeleton);
      if (loadMore && (!customEvent.detail || !customEvent.detail.isLastPage)) {
        showElement(loadMore);
      }
    });
    window._loadingEventRegistered = true;
  }
}
function bindThumbnailClickEvent() {
  const thumbnailList = document.getElementById("thumbnail-list");
  thumbnailList == null ? void 0 : thumbnailList.addEventListener("click", async (event) => {
    const target = event.target;
    const liElement = target == null ? void 0 : target.closest("li");
    if (liElement == null ? void 0 : liElement.id) {
      await handleItemClick(liElement.id);
    }
  });
}
function bindOnlineEvent(infiniteScrollInstance2) {
  window.addEventListener("online", () => {
    infiniteScrollInstance2 == null ? void 0 : infiniteScrollInstance2.resumeInfiniteScroll();
  });
}
function bindDetailsImageLoadEvent() {
  const detailsImage = document.getElementById("details-image");
  if (!detailsImage) return;
  detailsImage.addEventListener("load", () => {
    const skeleton = document.getElementById("details-skeleton");
    hideElement(skeleton);
    showElement(detailsImage);
  });
}
function bindModalEvents() {
  const modal = document.getElementById("modal-dialog");
  if (!(modal instanceof HTMLDialogElement)) return;
  const closeModalBtn = document.getElementById("closeModal");
  if (!closeModalBtn) return;
  closeModalBtn.addEventListener("click", () => {
    modal.close();
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.close();
    }
  });
}
function bindStarRatingEvents() {
  const radios = document.querySelectorAll('input[name="star-rating"]');
  for (const radio of radios) {
    radio.addEventListener("change", () => {
      const starRatingDetails = document.getElementById("star-rating-details");
      const starRatingNumbers = document.getElementById("star-rating-numbers");
      if (!(starRatingDetails instanceof HTMLElement) || !(starRatingNumbers instanceof HTMLElement)) {
        return;
      }
      if (!(radio instanceof HTMLInputElement)) {
        return;
      }
      const ratingValue = Number(radio.value);
      if (!ratingMessages[ratingValue] || !ratingNumbers[ratingValue]) {
        return;
      }
      starRatingDetails.innerText = ratingMessages[ratingValue];
      starRatingNumbers.innerText = ratingNumbers[ratingValue];
      localStorage.setItem(getShowingItem(), String(ratingValue));
    });
  }
}
let infiniteScrollInstance = null;
const initMovies = () => {
  return createMovieLoader(
    URLS.popularMovieUrl,
    defaultQueryObject,
    defaultOptions,
    handleError
  );
};
const handleError = (error) => {
  Toast.showToast(error.message, "error", 5e3);
  checkApiAvailability(infiniteScrollInstance);
};
const renderApp = (data) => {
  renderHeaderAndHero();
  const firstMovieShown = data.results[0];
  setShowingItem(data.results[0].id);
  updateHero(firstMovieShown);
  updateDetails(firstMovieShown);
  renderMovieItems(data.results, false);
};
const bindEventListeners = () => {
  bindLoadingEvents();
  bindThumbnailClickEvent();
  bindModalEvents();
  bindStarRatingEvents();
  bindDetailsImageLoadEvent();
  bindOnlineEvent(infiniteScrollInstance);
};
const main = async () => {
  try {
    const loadMovies2 = initMovies();
    setLoadMovies(loadMovies2);
    const data = await fetchAndSetLoadingEvent();
    infiniteScrollInstance = setupInfiniteScroll();
    renderApp(data);
    bindEventListeners();
  } catch (error) {
    handleConnectionError();
  }
};
main();
