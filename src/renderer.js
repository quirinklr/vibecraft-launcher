document.addEventListener("DOMContentLoaded", () => {
  const converter = new showdown.Converter({
    ghCompatibleHeaderId: true,
    simpleLineBreaks: true,
    ghMentions: true,
    openLinksInNewWindow: false,
  });

  const releaseList = document.getElementById("release-list");
  const releaseDetails = document.getElementById("release-details");
  const playButton = document.getElementById("play-button");

  let allReleases = [];
  let selectedRelease = null;
  let isGameRunning = false;

  async function loadReleases() {
    releaseList.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
    playButton.disabled = true;

    const result = await window.electronAPI.getReleases();

    if (!result.success || !result.data || result.data.length === 0) {
      releaseList.innerHTML = `<p class="error-message">Could not fetch releases.<br><small>${result.error || ""}</small></p>`;
      return;
    }

    allReleases = result.data;
    releaseList.innerHTML = "";

    allReleases.forEach((release, index) => {
      const item = document.createElement("div");
      item.className = "release-item";
      item.dataset.releaseId = release.id;

      if (index === 0) {
        item.innerHTML = `<span>${release.tag_name}</span> <span class="latest-tag">LATEST</span>`;
      } else {
        item.textContent = release.tag_name;
      }

      item.addEventListener("click", () => selectRelease(release));
      releaseList.appendChild(item);
    });

    if (allReleases.length > 0) {
      selectRelease(allReleases[0]);
    }
  }

  function selectRelease(release) {
    selectedRelease = release;

    document.querySelectorAll(".release-item").forEach((item) => {
      item.classList.toggle("selected", item.dataset.releaseId === release.id.toString());
    });

    const markdownBody = `# ${release.name}\n\n${release.body}`;
    const generatedHtml = converter.makeHtml(markdownBody);

    console.log("--- Generated HTML for Release Body ---");
    console.log(generatedHtml);

    releaseDetails.innerHTML = generatedHtml;

    releaseDetails.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        window.electronAPI.openExternalLink(e.currentTarget.href);
      });
    });

    if (!isGameRunning) {
      playButton.disabled = false;
      playButton.textContent = "Play";
    }
  }

  playButton.addEventListener("click", () => {
    if (selectedRelease && !isGameRunning) {
      window.electronAPI.launchGame(selectedRelease);
    }
  });

  window.electronAPI.onGameStatusUpdate((status) => {
    console.log("Status-Update erhalten:", status);
    switch (status) {
      case "Running":
        isGameRunning = true;
        playButton.disabled = true;
        playButton.textContent = "Running";
        break;
      case "Ready":
        isGameRunning = false;
        playButton.disabled = false;
        playButton.textContent = "Play";
        break;
      default:
        isGameRunning = false;
        playButton.disabled = true;
        playButton.textContent = status;
    }
  });

  loadReleases();
});
