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
const URLS = {
  config: "https://api.themoviedb.org/3/configuration",
  popularMovieUrl: "https://api.themoviedb.org/3/movie/popular",
  searchMovieUrl: "https://api.themoviedb.org/3/search/movie",
  detailsMovieUrl: "https://api.themoviedb.org/3/movie",
  imgW500: "https://image.tmdb.org/t/p/w500"
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
let showingItem = "";
let loadMovies = null;
let scrollInstance = null;
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
function setScrollInstance(instance) {
  scrollInstance = instance;
}
function getScrollInstance() {
  return scrollInstance;
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
function getPlainQuery(queryObj) {
  return queryObj instanceof URLSearchParams ? Object.fromEntries(queryObj.entries()) : queryObj;
}
function buildQuery(plainQuery, searchTerm, page) {
  return searchTerm ? { query: searchTerm, ...plainQuery, page: String(page) } : { ...plainQuery, page: String(page) };
}
const ERROR_MESSAGE = {
  FETCH_ERROR: "API 서버 상태가 좋지 않아 데이터를 가져오는데 실패했습니다. 네트워크 상태를 확인하고 더보기 버튼을 눌러주세요.",
  NO_DATA: "검색 결과가 없습니다. 다른 검색어를 입력해 보세요.",
  SERVER_ERROR: "서버에서 오류가 발생했습니다. 관리자에게 문의하세요. ",
  NETWORK_DISCONNECTED: "인터넷 연결이 끊어졌습니다. 연결을 확인하고 더보기 버튼을 눌러주세요.",
  FALLBACK_ERROR: "통신 상황이 좋지 않으니, 잠시후 새로고침하고 다시 시도해주세요.",
  RETRY_ERROR: "최대 대기 시간(1분)을 초과했습니다. 인터넷 상태를 체크하신뒤에 새로 고침을 해주세요."
};
function createUrlWithParams(baseUrl, path, queryObject = {}) {
  let url = baseUrl;
  if (path) {
    url += `/${path}`;
  }
  const queryParams = queryObject instanceof URLSearchParams ? queryObject : new URLSearchParams(queryObject);
  const queryString = queryParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}
async function fetchUrl(url, queryObject, options = {}, path) {
  const finalUrl = createUrlWithParams(url, path, queryObject);
  try {
    const response = await fetch(finalUrl, options);
    if (!response.ok) {
      throw new Error(ERROR_MESSAGE.SERVER_ERROR);
    }
    const data = await response.json();
    return data;
  } catch (error) {
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
function handleConnectionError() {
  const $hero = document.getElementById("hero");
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  const $fallback = document.getElementById("fallback");
  const $fallbackDetails = document.getElementById("fallback-details");
  hideElement($hero);
  hideElement($thumbnailContainer);
  showElement($fallback);
  if ($fallbackDetails) {
    $fallbackDetails.innerText = ERROR_MESSAGE.FALLBACK_ERROR;
  }
}
function handleNetworkError() {
  const scrollInstance2 = getScrollInstance();
  if (scrollInstance2) {
    scrollInstance2.stopInfiniteScroll();
  }
  showLoadMoreButton();
}
const LOADING_EVENTS = {
  START: "loading:start",
  END: "loading:end"
};
async function fetchAndSetLoadingEvent(infiniteScrollInstance) {
  document.dispatchEvent(new CustomEvent(LOADING_EVENTS.START));
  const loadMovies2 = getLoadMovies();
  let data = null;
  try {
    if (typeof loadMovies2 === "function") {
      data = await loadMovies2();
    }
    document.dispatchEvent(
      new CustomEvent(LOADING_EVENTS.END, {
        detail: { isLastPage: (data == null ? void 0 : data.isLastPage) ?? false }
      })
    );
    return data;
  } catch (error) {
    document.dispatchEvent(
      new CustomEvent(LOADING_EVENTS.START, {
        detail: { isLastPage: true }
      })
    );
    handleNetworkError();
  }
}
function scrollToTop() {
  return new Promise((resolve) => {
    const onScroll = () => {
      if (window.scrollY === 0) {
        window.removeEventListener("scroll", onScroll);
        resolve();
      }
    };
    window.addEventListener("scroll", onScroll);
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
    if (window.scrollY === 0) {
      window.removeEventListener("scroll", onScroll);
      resolve();
    }
  });
}
function setupInfiniteScroll() {
  const $thumbnailContainer = document.getElementById("thumbnail-container");
  if (!$thumbnailContainer) return null;
  const sentinel = document.createElement("div");
  sentinel.id = "infinite-scroll-sentinel";
  $thumbnailContainer.appendChild(sentinel);
  let infiniteScrollSuspended = false;
  let isFetching = false;
  let debounceTimeoutId = null;
  function resumeInfiniteScroll() {
    if (debounceTimeoutId) {
      clearTimeout(debounceTimeoutId);
      debounceTimeoutId = null;
    }
    infiniteScrollSuspended = false;
    isFetching = false;
    if (sentinel.parentNode) {
      sentinel.parentNode.removeChild(sentinel);
    }
    if ($thumbnailContainer && observer) {
      $thumbnailContainer.appendChild(sentinel);
      observer.observe(sentinel);
    }
  }
  function stopInfiniteScroll() {
    if (debounceTimeoutId) {
      clearTimeout(debounceTimeoutId);
      debounceTimeoutId = null;
    }
    infiniteScrollSuspended = true;
    if (observer) {
      observer.unobserve(sentinel);
    }
    if (sentinel.parentNode) {
      sentinel.parentNode.removeChild(sentinel);
    }
  }
  const observerCallback = (entries) => {
    if (infiniteScrollSuspended || isFetching) return;
    const entry = entries[0];
    if (entry.isIntersecting) {
      if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
      }
      debounceTimeoutId = window.setTimeout(async () => {
        if (isFetching || infiniteScrollSuspended) {
          debounceTimeoutId = null;
          return;
        }
        isFetching = true;
        if (observer) {
          observer.unobserve(sentinel);
        }
        try {
          const data = await fetchAndSetLoadingEvent(instance);
          if (data == null ? void 0 : data.results) {
            const scrollY = window.scrollY;
            renderMovieItems(data.results, false);
            window.scrollTo(0, scrollY + 10);
          }
          if (data == null ? void 0 : data.isLastPage) {
            infiniteScrollSuspended = true;
          } else {
            if (sentinel.parentNode) {
              sentinel.parentNode.removeChild(sentinel);
            }
            if ($thumbnailContainer && observer) {
              $thumbnailContainer.appendChild(sentinel);
              observer.observe(sentinel);
            }
          }
        } catch (error) {
          console.error("Fetch error:", error);
        } finally {
          isFetching = false;
          debounceTimeoutId = null;
        }
      }, 700);
    }
  };
  const observer = new IntersectionObserver(observerCallback, {
    root: null,
    rootMargin: "20px",
    threshold: 0.2
  });
  observer.observe(sentinel);
  const instance = { observer, resumeInfiniteScroll, stopInfiniteScroll };
  return instance;
}
async function handleSearch(searchValue) {
  await scrollToTop();
  setSearchResultTitle(searchValue);
  setSearchLoadingState();
  setLoadMovies(
    createMovieLoader(
      URLS.searchMovieUrl,
      defaultQueryObject,
      defaultOptions,
      (error) => handleSearchError(error),
      searchValue
    )
  );
  const scrollInstance2 = getScrollInstance();
  scrollInstance2 == null ? void 0 : scrollInstance2.stopInfiniteScroll();
  try {
    const data = await fetchAndSetLoadingEvent(scrollInstance2);
    if (data == null ? void 0 : data.results) renderMovieItems(data.results, true);
    if (data == null ? void 0 : data.isLastPage) scrollInstance2 == null ? void 0 : scrollInstance2.stopInfiniteScroll();
    else {
      scrollInstance2 == null ? void 0 : scrollInstance2.resumeInfiniteScroll();
    }
    displaySearchResults();
  } catch (error) {
    handleSearchError(error);
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
  if (error.message !== ERROR_MESSAGE.NO_DATA) {
    Toast.showToast(error.message, "error", 3e3);
    handleNetworkError();
  } else {
    const scrollInstance2 = getScrollInstance();
    if (scrollInstance2) scrollInstance2.stopInfiniteScroll();
    const $thumbnailContainer = document.getElementById("thumbnail-container");
    const $fallback = document.getElementById("fallback");
    const $fallbackDetails = document.getElementById("fallback-details");
    Toast.showToast(error.message, "error", 5e3);
    if ($fallbackDetails) $fallbackDetails.innerText = ERROR_MESSAGE.NO_DATA;
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
    <div class="hero-skeleton" id="hero-skeleton"></div>
    <img id="hero-img" alt="Hero Image" class="hero-img"/>
    <div class="overlay">
      <div class="top-rated-container">
        <div class="top-rated-movie hide" id="top-rated-container">
          <div class="rate">
            <img src="${paths.star_empty}" class="star" />
            <span class="rate-value" id="hero-rate"></span>
          </div>
          <div class="title" id="hero-title"></div>
          <button class="detail" id="hero-details-button">자세히 보기</button>
        </div>
      </div>
    </div>
  `;
  return backgroundHero;
}
function MovieItem({ id, src, title, rate, onload }) {
  const $li = createElement("li", { id });
  let url = `${URLS.imgW500}${src}`;
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
async function handleItemClick(id) {
  try {
    const modal = document.getElementById(
      "modal-dialog"
    );
    if (modal) {
      modal.showModal();
    }
    const loadingSpinner = document.getElementById("detail-loading");
    const modalContainer = document.getElementById("modal-container");
    if (loadingSpinner && modalContainer) {
      showElement(loadingSpinner);
      hideElement(modalContainer);
    }
    const result = await fetchUrl(
      URLS.detailsMovieUrl,
      defaultQueryObject,
      defaultOptions,
      id
    );
    updateDetails(result);
    updateHero(result);
    setShowingItem(id);
    if (loadingSpinner && modalContainer) {
      hideElement(loadingSpinner);
      showElement(modalContainer);
    }
  } catch (error) {
    const modal = document.getElementById(
      "modal-dialog"
    );
    if (modal) {
      modal.close();
    }
    if (error instanceof Error) Toast.showToast(error.message, "error", 5e3);
  }
}
const handleLoadingStart = () => {
  const skeleton = document.querySelector(".skeleton-list");
  const loadMore = document.getElementById("load-more");
  if (skeleton) showElement(skeleton);
  if (loadMore) hideElement(loadMore);
};
const handleLoadingEnd = () => {
  const skeleton = document.querySelector(".skeleton-list");
  if (skeleton) hideElement(skeleton);
};
let isLoadingEventRegistered = false;
function bindLoadingEvents() {
  if (!isLoadingEventRegistered) {
    document.addEventListener(LOADING_EVENTS.START, handleLoadingStart);
    document.addEventListener(LOADING_EVENTS.END, handleLoadingEnd);
    isLoadingEventRegistered = true;
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
  const starRatingDetails = document.getElementById(
    "star-rating-details"
  );
  const starRatingNumbers = document.getElementById(
    "star-rating-numbers"
  );
  const radios = document.querySelectorAll('input[name="star-rating"]');
  for (const radio of radios) {
    radio.addEventListener("change", () => {
      if (!(radio instanceof HTMLInputElement)) return;
      const ratingValue = radio.value;
      if (!ratingMessages[ratingValue] || !ratingNumbers[ratingValue]) return;
      starRatingDetails.innerText = ratingMessages[ratingValue];
      starRatingNumbers.innerText = ratingNumbers[ratingValue];
      const showingItem2 = getShowingItem();
      localStorage.setItem(showingItem2, String(ratingValue));
    });
  }
}
function bindHeaderScrollEvent() {
  window.addEventListener("scroll", () => {
    const header = document.querySelector(".header");
    if (window.scrollY > 50) {
      header == null ? void 0 : header.classList.add("dim");
    } else {
      header == null ? void 0 : header.classList.remove("dim");
    }
  });
}
function bindHeroEvents() {
  const heroImg = document.getElementById("hero-img");
  const heroSkeleton = document.getElementById("hero-skeleton");
  const topRatedContainer = document.getElementById("top-rated-container");
  const heroButton = document.getElementById("hero-details-button");
  const modal = document.getElementById("modal-dialog");
  if (heroImg) {
    heroImg.addEventListener("load", () => {
      hideElement(heroSkeleton);
      showElement(topRatedContainer);
    });
  }
  if (heroButton && modal) {
    heroButton.addEventListener("click", () => {
      modal.showModal();
      const loadingSpinner = document.getElementById("detail-loading");
      const modalContainer = document.getElementById("modal-container");
      if (loadingSpinner && modalContainer) {
        hideElement(loadingSpinner);
        showElement(modalContainer);
      }
      const detailsSkeleton = document.getElementById("details-skeleton");
      const detailsImage = document.getElementById(
        "details-image"
      );
      if (detailsSkeleton && detailsImage) {
        showElement(detailsSkeleton);
        hideElement(detailsImage);
        if (detailsImage.complete) {
          hideElement(detailsSkeleton);
          showElement(detailsImage);
        } else {
          detailsImage.onload = () => {
            hideElement(detailsSkeleton);
            showElement(detailsImage);
          };
        }
      }
    });
  }
}
function bindLoadMoreButton(infiniteScrollInstance) {
  const loadMoreButton = document.getElementById("load-more");
  if (!loadMoreButton) return;
  loadMoreButton.addEventListener("click", async () => {
    try {
      const response = await fetch(URLS.config, {
        ...defaultOptions,
        method: "GET"
      });
      if (response.ok) {
        if (infiniteScrollInstance) {
          infiniteScrollInstance.resumeInfiniteScroll();
        }
      } else {
        Toast.showToast(
          "인터넷 연결을 확인하고 더보기 버튼을 눌러주세요.",
          "error",
          2e3
        );
      }
    } catch (error) {
      Toast.showToast(
        "인터넷 연결을 확인하고 더보기 버튼을 눌러주세요.",
        "error",
        2e3
      );
    }
  });
}
function bindAllEvents(infiniteScrollInstance) {
  bindLoadingEvents();
  bindThumbnailClickEvent();
  bindModalEvents();
  bindStarRatingEvents();
  bindHeaderScrollEvent();
  bindHeroEvents();
  bindLoadMoreButton(infiniteScrollInstance);
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
  if (reset && $list) {
    $list.innerHTML = "";
  }
  for (const result of results) {
    const { id, title, poster_path, vote_average } = result;
    const movieItem = MovieItem({
      id,
      title,
      src: poster_path,
      rate: vote_average,
      onload: hideImgSkeleton
    });
    $list == null ? void 0 : $list.appendChild(movieItem);
  }
}
function renderHeaderAndHero() {
  const $wrap = document.getElementById("wrap");
  if ($wrap) {
    $wrap.prepend(Header());
    $wrap.prepend(Hero());
  }
}
function renderHeroImage(heroImg, poster_path) {
  const url = getHeroImageUrl(poster_path);
  heroImg.src = url;
}
function renderHeroContent(heroAverage, heroTitle, topRatedContainer, vote_average, title) {
  if (heroAverage) heroAverage.innerText = Number(vote_average).toFixed(1);
  if (heroTitle) heroTitle.innerText = title;
  showElement(topRatedContainer);
}
function updateHero({ poster_path, title, vote_average }) {
  const heroImg = document.getElementById("hero-img");
  const heroTitle = document.getElementById("hero-title");
  const heroAverage = document.getElementById("hero-rate");
  const topRatedContainer = document.getElementById("top-rated-container");
  if (heroImg) {
    renderHeroImage(heroImg, poster_path);
  }
  renderHeroContent(
    heroAverage,
    heroTitle,
    topRatedContainer,
    vote_average,
    title
  );
  bindHeroEvents();
}
function renderDetailsContent(detailsTitle, detailsRate, detailsCategory, detailsDescription, title, vote_average, categoryNames, overview) {
  detailsTitle.innerText = title;
  detailsRate.innerText = Number(vote_average).toFixed(1);
  detailsCategory.innerText = categoryNames;
  detailsDescription.innerText = overview;
}
function renderDetailsImage(detailsImage, detailsSkeleton, imgUrl) {
  hideElement(detailsImage);
  if (detailsSkeleton) {
    showElement(detailsSkeleton);
  }
  detailsImage.src = imgUrl;
  detailsImage.onload = () => {
    if (detailsSkeleton) {
      hideElement(detailsSkeleton);
    }
    showElement(detailsImage);
  };
}
function renderRatingDisplay(id, starRatingDetails, starRatingNumbers) {
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
  const detailsSkeleton = document.getElementById("details-skeleton");
  const categoryNames = getCategoryNames(genres, release_date);
  const imgUrl = getDetailsImageUrl(poster_path);
  renderDetailsContent(
    detailsTitle,
    detailsRate,
    detailsCategory,
    detailsDescription,
    title,
    vote_average,
    categoryNames,
    overview
  );
  if (detailsImage && detailsSkeleton) {
    renderDetailsImage(detailsImage, detailsSkeleton, imgUrl);
  }
  renderRatingDisplay(id, starRatingDetails, starRatingNumbers);
}
function getHeroImageUrl(poster_path) {
  if (!poster_path) return "images/fallback.png";
  return `https://image.tmdb.org/t/p/original${poster_path}`;
}
function getDetailsImageUrl(poster_path) {
  if (!poster_path) return "./images/fallback_no_movies.png";
  return `https://image.tmdb.org/t/p/original${poster_path}`;
}
function getCategoryNames(genres, release_date) {
  if (!genres) return "";
  return `${new Date(release_date).getFullYear()} · ${genres.map((genre) => genre.name).join(", ")} `;
}
function showLoadMoreButton() {
  const $loadMore = document.getElementById("load-more");
  showElement($loadMore);
}
const convertResultToTMDBDetails = (movie) => {
  return {
    poster_path: movie.poster_path || "",
    release_date: new Date(movie.release_date),
    overview: movie.overview,
    title: movie.title,
    vote_average: movie.vote_average,
    id: movie.id,
    adult: movie.adult,
    backdrop_path: movie.backdrop_path || "",
    belongs_to_collection: {
      id: 0,
      name: "",
      poster_path: "",
      backdrop_path: ""
    },
    budget: 0,
    genres: [],
    homepage: "",
    imdb_id: "",
    origin_country: [],
    original_language: movie.original_language,
    original_title: movie.original_title,
    popularity: movie.popularity,
    production_companies: [],
    production_countries: [],
    revenue: 0,
    runtime: 0,
    spoken_languages: [],
    status: "",
    tagline: "",
    video: movie.video,
    vote_count: movie.vote_count
  };
};
function initScrollToTopButton() {
  const scrollToTopBtn = document.getElementById("scroll-to-top-btn");
  if (!scrollToTopBtn) return;
  let lastScrollY = window.scrollY;
  let ticking = false;
  const handleScroll = () => {
    lastScrollY = window.scrollY;
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateButtonVisibility(lastScrollY);
        ticking = false;
      });
      ticking = true;
    }
  };
  const updateButtonVisibility = (scrollY) => {
    if (scrollY > 300) {
      if (!scrollToTopBtn.classList.contains("show")) {
        scrollToTopBtn.classList.remove("hide");
        void scrollToTopBtn.offsetWidth;
        scrollToTopBtn.classList.add("show");
      }
    } else {
      if (scrollToTopBtn.classList.contains("show")) {
        scrollToTopBtn.classList.remove("show");
        setTimeout(() => {
          scrollToTopBtn.classList.add("hide");
        }, 400);
      }
    }
  };
  window.addEventListener("scroll", handleScroll, { passive: true });
  updateButtonVisibility(window.scrollY);
  scrollToTopBtn.addEventListener("click", () => {
    scrollToTop();
  });
}
const handleError = (error) => {
  Toast.showToast(error.message, "error", 5e3);
  handleNetworkError();
};
const initMovies = () => {
  return createMovieLoader(
    URLS.popularMovieUrl,
    defaultQueryObject,
    defaultOptions,
    handleError
  );
};
const main = async () => {
  try {
    const loadMovies2 = initMovies();
    setLoadMovies(loadMovies2);
    const data = await fetchAndSetLoadingEvent(null);
    if (!data) {
      throw new Error("데이터가 없습니다. 잠시후 다시 사용해주세요.");
    }
    const firstMovie = data.results[0];
    setShowingItem(String(firstMovie.id));
    renderHeaderAndHero();
    updateHero(firstMovie);
    updateDetails(convertResultToTMDBDetails(firstMovie));
    renderMovieItems(data.results, false);
    const infiniteScrollInstance = setupInfiniteScroll();
    setScrollInstance(infiniteScrollInstance);
    bindAllEvents(infiniteScrollInstance);
    initScrollToTopButton();
  } catch (error) {
    handleConnectionError();
  }
};
main();
