import React, { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { compressImage, canStoreInLocalStorage } from "./utils/imageCompression";
import {
  generateCharacters,
  generateStoryboard,
  regenerateCharacterImage,
  regenerateStoryboardImage,
  generateCameraAngles,
} from "./services/geminiService";
import { detectUnsafeWords, replaceUnsafeWords } from "./utils/contentSafety";
import {
  AspectRatio,
  BackgroundStyle,
  CameraAngle,
  CameraAngleImage,
  Character,
  CharacterStyle,
  ImageStyle,
  PhotoComposition,
  VideoSourceImage,
} from "./types";
import AspectRatioSelector from "./components/AspectRatioSelector";
import Spinner from "./components/Spinner";
import CharacterCard from "./components/CharacterCard";
import StoryboardImage from "./components/StoryboardImage";
import Slider from "./components/Slider";
import MetaTags from "./components/MetaTags";
import UserGuide from "./components/UserGuide";
import AdBanner from "./components/AdBanner";
import FloatingBottomAd from "./components/FloatingBottomAd";
import SideFloatingAd from "./components/SideFloatingAd";
import AdBlockDetector from "./components/AdBlockDetector";

type ImageAppView = "main" | "user-guide" | "image-prompt";

interface ImageAppProps {
  basePath?: string;
  initialScript?: string;
}

const App: React.FC<ImageAppProps> = ({
  basePath = "/image",
  initialScript = "",
}) => {
  const [currentView, setCurrentView] = useState<ImageAppView>("main");
  const navigate = useNavigate();
  const location = useLocation();
  const navigationScript =
    ((location.state as { script?: string } | null)?.script) || "";
  const normalizedBasePath =
    basePath && basePath !== "/" ? basePath.replace(/\/$/, "") : "";
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  const [imageStyle, setImageStyle] = useState<"realistic" | "animation">(
    "realistic"
  ); // ±âÁ¸ ÀÌ¹ÌÁö ½ºÅ¸ÀÏ (½Ç»ç/¾Ö´Ï¸ÞÀÌ¼Ç)
  const [personaStyle, setPersonaStyle] = useState<ImageStyle>("½Ç»ç ±Ø´ëÈ­"); // ±âÁ¸ Æä¸£¼Ò³ª ½ºÅ¸ÀÏ (È£È¯¼º À¯Áö)
  const [characterStyle, setCharacterStyle] =
    useState<CharacterStyle>("½Ç»ç ±Ø´ëÈ­"); // ÀÎ¹° ½ºÅ¸ÀÏ
  const [backgroundStyle, setBackgroundStyle] =
    useState<BackgroundStyle>("¸ð´ø"); // ¹è°æ/ºÐÀ§±â ½ºÅ¸ÀÏ
  const [customCharacterStyle, setCustomCharacterStyle] = useState<string>(""); // Ä¿½ºÅÒ ÀÎ¹° ½ºÅ¸ÀÏ
  const [customBackgroundStyle, setCustomBackgroundStyle] =
    useState<string>(""); // Ä¿½ºÅÒ ¹è°æ ½ºÅ¸ÀÏ
  const [customStyle, setCustomStyle] = useState<string>(""); // Ä¿½ºÅÒ ½ºÅ¸ÀÏ ÀÔ·Â (±âÁ¸ È£È¯¼º)
  const [photoComposition, setPhotoComposition] =
    useState<PhotoComposition>("Á¤¸é"); // »çÁø ±¸µµ
  const [customPrompt, setCustomPrompt] = useState<string>(""); // Ä¿½ºÅÒ ÀÌ¹ÌÁö ÇÁ·ÒÇÁÆ®
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9"); // ÀÌ¹ÌÁö ºñÀ² ¼±ÅÃ
  const [personaInput, setPersonaInput] = useState<string>(""); // Æä¸£¼Ò³ª »ý¼º¿ë ÀÔ·Â
  const [videoSourceScript, setVideoSourceScript] = useState<string>(""); // ¿µ»ó ¼Ò½º¿ë ´ëº»
  const [subtitleEnabled, setSubtitleEnabled] = useState<boolean>(false); // ÀÚ¸· Æ÷ÇÔ ¿©ºÎ - ±âº» OFF
  const [personaReferenceImage, setPersonaReferenceImage] = useState<
    string | null
  >(null); // Æä¸£¼Ò³ª¿ë ÂüÁ¶ ÀÌ¹ÌÁö (¼±ÅÃ»çÇ×)
  const [referenceImage, setReferenceImage] = useState<string | null>(null); // ¿µ»ó ¼Ò½º¿ë ÂüÁ¶ ÀÌ¹ÌÁö
  const [characters, setCharacters] = useState<Character[]>([]);
  const [videoSource, setVideoSource] = useState<VideoSourceImage[]>([]);
  const [imageCount, setImageCount] = useState<number>(5);
  const [isLoadingCharacters, setIsLoadingCharacters] =
    useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>(""); // ·Îµù ÁøÇà »óÈ² ¸Þ½ÃÁö
  const [isLoadingVideoSource, setIsLoadingVideoSource] =
    useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [contentWarning, setContentWarning] = useState<{
    unsafeWords: string[];
    replacements: Array<{ original: string; replacement: string }>;
  } | null>(null);
  const [isContentWarningAcknowledged, setIsContentWarningAcknowledged] =
    useState<boolean>(false);
  const [hasContentWarning, setHasContentWarning] = useState<boolean>(false);
  const [hoveredStyle, setHoveredStyle] = useState<string | null>(null); // È£¹öµÈ ½ºÅ¸ÀÏ
  
  // Ä«¸Þ¶ó ¾Þ±Û ±â´É °ü·Ã state
  const [cameraAngleSourceImage, setCameraAngleSourceImage] = useState<string | null>(null);
  const [selectedCameraAngles, setSelectedCameraAngles] = useState<CameraAngle[]>([
    'Front View', 'Right Side View', 'Left Side View', 'Back View', 'Full Body', 'Close-up Face'
  ]); // ±âº»°ª: ÀüÃ¼ ¼±ÅÃ
  const [cameraAngles, setCameraAngles] = useState<CameraAngleImage[]>([]);
  const [isLoadingCameraAngles, setIsLoadingCameraAngles] = useState<boolean>(false);
  const [cameraAngleProgress, setCameraAngleProgress] = useState<string>("");
  const [cameraAngleError, setCameraAngleError] = useState<string | null>(null);

  // URL ±â¹Ý ÇöÀç ºä °áÁ¤
  useEffect(() => {
    const path = decodeURIComponent(location.pathname);
    const relativePath =
      normalizedBasePath && path.startsWith(normalizedBasePath)
        ? path.slice(normalizedBasePath.length) || "/"
        : path;

    if (
      relativePath === "/user-guide" ||
      (relativePath.includes("»ç¿ë¹ý") && relativePath.includes("°¡ÀÌµå"))
    ) {
      setCurrentView("user-guide");
    } else if (relativePath === "/image-prompt") {
      setCurrentView("image-prompt");
    } else {
      setCurrentView("main");
    }
  }, [location.pathname, normalizedBasePath]);

  const navigateToView = useCallback(
    (view: ImageAppView) => {
      setCurrentView(view);
      const suffix =
        view === "user-guide"
          ? "/user-guide"
          : view === "image-prompt"
            ? "/image-prompt"
            : "";
      const targetPath =
        ((normalizedBasePath || "") + suffix) || "/";
      navigate(targetPath, { replace: true });
    },
    [navigate, normalizedBasePath]
  );

  // ÄÄÆ÷³ÍÆ® ¸¶¿îÆ® ½Ã ÀúÀåµÈ ÀÛ¾÷ µ¥ÀÌÅÍ ºÒ·¯¿À±â (localStorage ¿ì¼±, ¾øÀ¸¸é sessionStorage)
  useEffect(() => {
    try {
      let savedData = localStorage.getItem("youtube_image_work_data");
      let source = "localStorage";
      
      // localStorage¿¡ ¾øÀ¸¸é sessionStorage È®ÀÎ
      if (!savedData) {
        savedData = sessionStorage.getItem("youtube_image_work_data");
        source = "sessionStorage";
      }
      
      console.log(`?? ${source}¿¡¼­ µ¥ÀÌÅÍ ºÒ·¯¿À±â ½Ãµµ...`, savedData ? `${savedData.length} bytes` : "¾øÀ½");
      
      if (savedData) {
        const parsed = JSON.parse(savedData);
        console.log("?? ÆÄ½ÌµÈ µ¥ÀÌÅÍ:", {
          characters: parsed.characters?.length || 0,
          videoSource: parsed.videoSource?.length || 0,
          cameraAngles: parsed.cameraAngles?.length || 0,
          savedAt: parsed.savedAt,
          version: parsed.version,
        });
        
        // º¹¿øµÈ Ç×¸ñ Ä«¿îÆ®
        let restoredCount = 0;
        const restoredItems: string[] = [];
        
        if (parsed.characters && parsed.characters.length > 0) {
          setCharacters(parsed.characters);
          restoredCount++;
          restoredItems.push(`Æä¸£¼Ò³ª: ${parsed.characters.length}°³`);
          console.log("? Æä¸£¼Ò³ª º¹¿ø:", parsed.characters.length, "°³");
        }
        if (parsed.videoSource && parsed.videoSource.length > 0) {
          setVideoSource(parsed.videoSource);
          restoredCount++;
          restoredItems.push(`¿µ»ó¼Ò½º: ${parsed.videoSource.length}°³`);
          console.log("? ¿µ»ó ¼Ò½º º¹¿ø:", parsed.videoSource.length, "°³");
        }
        if (parsed.cameraAngles && parsed.cameraAngles.length > 0) {
          setCameraAngles(parsed.cameraAngles);
          restoredCount++;
          restoredItems.push(`Ä«¸Þ¶ó¾Þ±Û: ${parsed.cameraAngles.length}°³`);
          console.log("? Ä«¸Þ¶ó ¾Þ±Û º¹¿ø:", parsed.cameraAngles.length, "°³");
        }
        
        // ¼³Á¤ º¹¿ø
        if (parsed.personaInput) setPersonaInput(parsed.personaInput);
        if (parsed.videoSourceScript)
          setVideoSourceScript(parsed.videoSourceScript);
        if (parsed.personaReferenceImage) {
          setPersonaReferenceImage(parsed.personaReferenceImage);
          restoredItems.push("Æä¸£¼Ò³ª ÂüÁ¶ ÀÌ¹ÌÁö ?");
          console.log("? Æä¸£¼Ò³ª ÂüÁ¶ ÀÌ¹ÌÁö º¹¿ø");
        }
        if (parsed.referenceImage) {
          setReferenceImage(parsed.referenceImage);
          restoredItems.push("¿µ»ó¼Ò½º ÂüÁ¶ ÀÌ¹ÌÁö ?");
          console.log("? ¿µ»ó¼Ò½º ÂüÁ¶ ÀÌ¹ÌÁö º¹¿ø");
        }
        if (parsed.imageStyle) setImageStyle(parsed.imageStyle);
        if (parsed.personaStyle) setPersonaStyle(parsed.personaStyle);
        if (parsed.customCharacterStyle) setCustomCharacterStyle(parsed.customCharacterStyle);
        if (parsed.customBackgroundStyle) setCustomBackgroundStyle(parsed.customBackgroundStyle);
        if (parsed.customStyle) setCustomStyle(parsed.customStyle);
        if (parsed.photoComposition) setPhotoComposition(parsed.photoComposition);
        if (parsed.customPrompt) setCustomPrompt(parsed.customPrompt);
        if (parsed.selectedCameraAngles && parsed.selectedCameraAngles.length > 0) {
          setSelectedCameraAngles(parsed.selectedCameraAngles);
        }
        if (parsed.characterStyle) setCharacterStyle(parsed.characterStyle);
        if (parsed.backgroundStyle) setBackgroundStyle(parsed.backgroundStyle);
        if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
        if (parsed.imageCount) setImageCount(parsed.imageCount);
        if (parsed.subtitleEnabled !== undefined)
          setSubtitleEnabled(parsed.subtitleEnabled);
        if (parsed.cameraAngleSourceImage) {
          setCameraAngleSourceImage(parsed.cameraAngleSourceImage);
          restoredItems.push("Ä«¸Þ¶ó¾Þ±Û ¿øº» ÀÌ¹ÌÁö ?");
          console.log("? Ä«¸Þ¶ó ¾Þ±Û ¿øº» ÀÌ¹ÌÁö º¹¿ø");
        }
        
        console.log(`?? ÀÛ¾÷ µ¥ÀÌÅÍ º¹¿ø ¿Ï·á (from ${source}):`, {
          Æä¸£¼Ò³ª: parsed.characters?.length || 0,
          ¿µ»ó¼Ò½º: parsed.videoSource?.length || 0,
          Ä«¸Þ¶ó¾Þ±Û: parsed.cameraAngles?.length || 0,
          savedAt: parsed.savedAt ? new Date(parsed.savedAt).toLocaleString('ko-KR') : 'unknown',
        });
        
        // º¹¿ø ¼º°ø ½Ã ÄÜ¼Ö¿¡¸¸ ·Î±× (¾Ë¸²Ã¢ Á¦°Å)
        if (restoredCount > 0 || restoredItems.length > 0) {
          // ¸¶Áö¸· ÀÛ¾÷ À¯Çü ÆÄ¾Ç (ÀúÀåµÈ °ª ¿ì¼± »ç¿ë)
          let lastWorkType = parsed.lastWorkType || '';
          
          // lastWorkTypeÀÌ ÀúÀåµÇÁö ¾ÊÀº °æ¿ì (ÀÌÀü ¹öÀü È£È¯¼º)
          if (!lastWorkType) {
            if (parsed.cameraAngles?.length > 0) {
              lastWorkType = 'Ä«¸Þ¶ó¾Þ±Û º¯È¯';
            } else if (parsed.videoSource?.length > 0) {
              lastWorkType = '¿µ»ó¼Ò½º »ý¼º';
            } else if (parsed.characters?.length > 0) {
              lastWorkType = 'Æä¸£¼Ò³ª »ý¼º';
            }
          }
          
          const savedTime = parsed.savedAt ? new Date(parsed.savedAt).toLocaleString('ko-KR') : '¾Ë ¼ö ¾øÀ½';
          
          console.log("?? º¹¿ø ¿Ï·á!");
          console.log(`?? ¸¶Áö¸· ÀÛ¾÷: ${lastWorkType}`);
          console.log(`? ÀúÀå ½Ã°¢: ${savedTime}`);
          console.log(`?? º¹¿øµÈ Ç×¸ñ: ${restoredItems.join(', ')}`);
        } else {
          console.log("?? º¹¿øÇÒ ÀÛ¾÷¹°ÀÌ ¾ø½À´Ï´Ù (¼³Á¤¸¸ º¹¿øµÊ)");
        }
      } else {
        console.log("?? ÀúÀåµÈ µ¥ÀÌÅÍ ¾øÀ½ (localStorage & sessionStorage ¸ðµÎ)");
      }
    } catch (e) {
      console.error("? ÀÛ¾÷ µ¥ÀÌÅÍ ºÒ·¯¿À±â ½ÇÆÐ:", e);
      // ¼Õ»óµÈ µ¥ÀÌÅÍ »èÁ¦
      try {
        localStorage.removeItem("youtube_image_work_data");
      } catch (storageError) {
        console.error("? localStorage Á¤¸® ½ÇÆÐ:", storageError);
      }
      try {
        sessionStorage.removeItem("youtube_image_work_data");
      } catch (storageError) {
        console.error("? sessionStorage Á¤¸® ½ÇÆÐ:", storageError);
      }
      alert("?? ÀúÀåµÈ µ¥ÀÌÅÍ°¡ ¼Õ»óµÇ¾î ºÒ·¯¿Ã ¼ö ¾ø½À´Ï´Ù.\n»õ·Î ½ÃÀÛÇØÁÖ¼¼¿ä.");
    }
  }, []);

  useEffect(() => {
    const scriptToApply = initialScript || navigationScript;
    if (scriptToApply && !videoSourceScript.trim()) {
      setVideoSourceScript(scriptToApply);
    }
  }, [initialScript, navigationScript, videoSourceScript]);

  // ÀúÀå ÇÔ¼ö¸¦ º°µµ·Î ºÐ¸® (Áï½Ã ÀúÀå °¡´ÉÇÏµµ·Ï)
  const saveDataToStorage = useCallback(async (immediate = false) => {
    // ÀúÀåÇÒ µ¥ÀÌÅÍ°¡ ¾øÀ¸¸é ½ºÅµ
    const hasWorkData =
      characters.length > 0 ||
      videoSource.length > 0 ||
      cameraAngles.length > 0 ||
      Boolean(personaInput.trim()) ||
      Boolean(videoSourceScript.trim()) ||
      Boolean(personaReferenceImage) ||
      Boolean(referenceImage) ||
      Boolean(customPrompt.trim()) ||
      Boolean(customStyle.trim()) ||
      Boolean(customCharacterStyle.trim()) ||
      Boolean(customBackgroundStyle.trim()) ||
      Boolean(cameraAngleSourceImage);

    if (!hasWorkData) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString('ko-KR');
    console.log(`?? [${timestamp}] µ¥ÀÌÅÍ ÀúÀå ½ÃÀÛ${immediate ? ' (Áï½Ã ÀúÀå)' : ''}:`, {
      Æä¸£¼Ò³ª: characters.length,
      ¿µ»ó¼Ò½º: videoSource.length,
      Ä«¸Þ¶ó¾Þ±Û: cameraAngles.length
    });
      
    try {
      // ÀÌ¹ÌÁö ¾ÐÃà (¿ë·® ÃÖÀûÈ­)
      console.log(`??? [${timestamp}] ÀÌ¹ÌÁö ¾ÐÃà ½ÃÀÛ...`);
      const compressedCharacters = await Promise.all(
        characters.slice(0, 10).map(async (char, idx) => {
          console.log(`  - Æä¸£¼Ò³ª #${idx + 1} ¾ÐÃà Áß...`);
          return {
            ...char,
            image: char.image ? await compressImage(char.image, 600, 0.6) : char.image,
          };
        })
      );
      console.log(`? [${timestamp}] Æä¸£¼Ò³ª ${compressedCharacters.length}°³ ¾ÐÃà ¿Ï·á`);

      const compressedVideoSource = await Promise.all(
        videoSource.slice(0, 10).map(async (source, idx) => {
          console.log(`  - ¿µ»ó¼Ò½º #${idx + 1} ¾ÐÃà Áß...`);
          return {
            ...source,
            image: source.image ? await compressImage(source.image, 600, 0.6) : source.image,
          };
        })
      );
      console.log(`? [${timestamp}] ¿µ»ó¼Ò½º ${compressedVideoSource.length}°³ ¾ÐÃà ¿Ï·á`);

      const compressedCameraAngles = await Promise.all(
        cameraAngles.slice(0, 10).map(async (angle, idx) => {
          console.log(`  - Ä«¸Þ¶ó¾Þ±Û #${idx + 1} ¾ÐÃà Áß...`);
          return {
            ...angle,
            image: angle.image ? await compressImage(angle.image, 600, 0.6) : angle.image,
          };
        })
      );
      console.log(`? [${timestamp}] Ä«¸Þ¶ó¾Þ±Û ${compressedCameraAngles.length}°³ ¾ÐÃà ¿Ï·á`);

      // ¸¶Áö¸· ÀÛ¾÷ À¯Çü °áÁ¤ (°¡Àå ÃÖ±Ù ÀÛ¾÷)
      let lastWorkType = '';
      if (compressedCameraAngles.length > 0) {
        lastWorkType = 'Ä«¸Þ¶ó¾Þ±Û º¯È¯';
      } else if (compressedVideoSource.length > 0) {
        lastWorkType = '¿µ»ó¼Ò½º »ý¼º';
      } else if (compressedCharacters.length > 0) {
        lastWorkType = 'Æä¸£¼Ò³ª »ý¼º';
      }

      const dataToSave: any = {
        characters: compressedCharacters,
        videoSource: compressedVideoSource,
        personaInput,
        videoSourceScript,
        personaStyle,
        customCharacterStyle,
        customBackgroundStyle,
        customStyle,
        photoComposition,
        customPrompt,
        selectedCameraAngles,
        personaReferenceImage: personaReferenceImage 
          ? await compressImage(personaReferenceImage, 400, 0.5) 
          : null,
        referenceImage: referenceImage 
          ? await compressImage(referenceImage, 400, 0.5) 
          : null,
        imageStyle,
        characterStyle,
        backgroundStyle,
        aspectRatio,
        imageCount,
        subtitleEnabled,
        cameraAngleSourceImage: cameraAngleSourceImage 
          ? await compressImage(cameraAngleSourceImage, 600, 0.6) 
          : null,
        cameraAngles: compressedCameraAngles,
        savedAt: new Date().toISOString(),
        version: "1.0.0", // ¹öÀü Ãß°¡·Î È£È¯¼º °ü¸®
      };

      // lastWorkTypeÀÌ ÀÖ´Â °æ¿ì¿¡¸¸ Ãß°¡
      if (lastWorkType) {
        dataToSave.lastWorkType = lastWorkType;
      }

      const jsonString = JSON.stringify(dataToSave);
      const sizeInMB = (jsonString.length / 1024 / 1024).toFixed(2);
      console.log(`?? [${timestamp}] ÀúÀåÇÒ µ¥ÀÌÅÍ Å©±â: ${sizeInMB}MB (${jsonString.length} bytes)`);

      // localStorage ¿ë·® Ã¼Å© (4MB Á¦ÇÑ)
      if (!canStoreInLocalStorage(jsonString, 4)) {
        console.warn(`?? [${timestamp}] µ¥ÀÌÅÍ°¡ ³Ê¹« Ä¿¼­ ÀÏºÎ¸¸ ÀúÀåÇÕ´Ï´Ù.`);
        // ¿ë·® ÃÊ°ú ½Ã Ä«¸Þ¶ó ¾Þ±Û Á¦¿ÜÇÏ°í Àç½Ãµµ
        const minimalData = {
          ...dataToSave,
          cameraAngles: [],
        };
        const minimalJsonString = JSON.stringify(minimalData);
        
        if (!canStoreInLocalStorage(minimalJsonString, 4)) {
          console.warn(`?? [${timestamp}] ¿©ÀüÈ÷ ¿ë·® ÃÊ°ú, ¿µ»ó ¼Ò½ºµµ Á¦¿ÜÇÕ´Ï´Ù.`);
          const veryMinimalData = {
            ...minimalData,
            videoSource: [],
          };
          localStorage.setItem("youtube_image_work_data", JSON.stringify(veryMinimalData));
          sessionStorage.setItem("youtube_image_work_data", JSON.stringify(veryMinimalData));
          console.log(`? [${timestamp}] ÃÖ¼Ò µ¥ÀÌÅÍ¸¸ ÀúÀåµÊ (Æä¸£¼Ò³ª + ¼³Á¤)`);
        } else {
          localStorage.setItem("youtube_image_work_data", minimalJsonString);
          sessionStorage.setItem("youtube_image_work_data", minimalJsonString);
          console.log(`? [${timestamp}] ÀÏºÎ µ¥ÀÌÅÍ ÀúÀåµÊ (Ä«¸Þ¶ó ¾Þ±Û Á¦¿Ü)`);
        }
      } else {
        localStorage.setItem("youtube_image_work_data", jsonString);
        sessionStorage.setItem("youtube_image_work_data", jsonString);
        console.log(`? [${timestamp}] ÀüÃ¼ µ¥ÀÌÅÍ ÀúÀå ¿Ï·á! (localStorage + sessionStorage ÀÌÁß ¹é¾÷)`);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "QuotaExceededError") {
        console.error("? localStorage ¿ë·® ÃÊ°ú! ÀÌÀü µ¥ÀÌÅÍ¸¦ »èÁ¦ÇÕ´Ï´Ù.");
        localStorage.removeItem("youtube_image_work_data");
        sessionStorage.removeItem("youtube_image_work_data");
        try {
          // ÃÖ¼Ò µ¥ÀÌÅÍ¸¸ ÀúÀå
          const minimalData = {
            personaInput,
            videoSourceScript,
            personaStyle,
            customCharacterStyle,
            customBackgroundStyle,
            customStyle,
            photoComposition,
            customPrompt,
            selectedCameraAngles,
            imageStyle,
            characterStyle,
            backgroundStyle,
            aspectRatio,
            imageCount,
            subtitleEnabled,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem("youtube_image_work_data", JSON.stringify(minimalData));
          console.log("? ¼³Á¤ µ¥ÀÌÅÍ¸¸ ÀúÀåµÊ");
        } catch (retryError) {
          console.error("? Àç½Ãµµµµ ½ÇÆÐ:", retryError);
        }
      } else {
        console.error("? ÀÛ¾÷ µ¥ÀÌÅÍ ÀúÀå ½ÇÆÐ:", e);
      }
    }
  }, [
    characters,
    videoSource,
    personaInput,
    videoSourceScript,
    personaStyle,
    customCharacterStyle,
    customBackgroundStyle,
    customStyle,
    photoComposition,
    customPrompt,
    selectedCameraAngles,
    personaReferenceImage,
    referenceImage,
    imageStyle,
    characterStyle,
    backgroundStyle,
    aspectRatio,
    imageCount,
    subtitleEnabled,
    cameraAngleSourceImage,
    cameraAngles,
  ]);

  // ÀÛ¾÷ µ¥ÀÌÅÍ°¡ º¯°æµÉ ¶§¸¶´Ù localStorage + sessionStorage¿¡ ÀúÀå (ÀÌÁß ¹é¾÷)
  useEffect(() => {
    // ÃÊ±â ¸¶¿îÆ® ½Ã¿¡´Â ÀúÀåÇÏÁö ¾ÊÀ½ (µ¥ÀÌÅÍ ·Îµå ÈÄ¿¡¸¸ ÀúÀå)
    const hasData =
      characters.length > 0 ||
      videoSource.length > 0 ||
      cameraAngles.length > 0 ||
      Boolean(personaInput.trim()) ||
      Boolean(videoSourceScript.trim()) ||
      Boolean(personaReferenceImage) ||
      Boolean(referenceImage) ||
      Boolean(customPrompt.trim()) ||
      Boolean(customStyle.trim()) ||
      Boolean(customCharacterStyle.trim()) ||
      Boolean(customBackgroundStyle.trim()) ||
      Boolean(cameraAngleSourceImage);
    
    if (!hasData) {
      return; // µ¥ÀÌÅÍ°¡ ¾øÀ¸¸é ÀúÀåÇÏÁö ¾ÊÀ½
    }
    
    // debounce¸¦ À§ÇØ Å¸ÀÌ¸Ó »ç¿ë
    const timer = setTimeout(() => {
      console.log('?? ÀÚµ¿ ÀúÀå Æ®¸®°Å (1ÃÊ debounce ÈÄ)');
      saveDataToStorage(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    saveDataToStorage,
    characters.length,
    videoSource.length,
    cameraAngles.length,
    personaInput,
    videoSourceScript,
    personaReferenceImage,
    referenceImage,
    customPrompt,
    customStyle,
    customCharacterStyle,
    customBackgroundStyle,
    cameraAngleSourceImage,
  ]);

  // º¸¾È: µå·¡±×, ¿ìÅ¬¸¯, Ä¸Ã³ ¹æÁö
  useEffect(() => {
    // ÀÔ·Â ÇÊµåÀÎÁö È®ÀÎÇÏ´Â ÇïÆÛ ÇÔ¼ö
    const isInputField = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === "input" ||
        tagName === "textarea" ||
        target.isContentEditable
      );
    };

    // µå·¡±×, ¼±ÅÃ, ¿ìÅ¬¸¯, º¹»ç Â÷´Ü (ÀÔ·Â ÇÊµå Á¦¿Ü)
    const preventDefaultExceptInput = (e: Event) => {
      if (!isInputField(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    document.addEventListener("contextmenu", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("selectstart", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("dragstart", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("copy", preventDefaultExceptInput, {
      capture: true,
    });
    document.addEventListener("cut", preventDefaultExceptInput, {
      capture: true,
    });

    // ¸¶¿ì½º ¿ìÅ¬¸¯ Â÷´Ü (µå·¡±×ÇÁ¸®·ù ¿ìÈ¸ ¹æÁö, ÀÔ·Â ÇÊµå Á¦¿Ü)
    const blockRightClick = (e: MouseEvent) => {
      if (e.button === 2 && !isInputField(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    document.addEventListener("mousedown", blockRightClick, { capture: true });
    document.addEventListener("mouseup", blockRightClick, { capture: true });

    // CSS·Î ¼±ÅÃ ¹æÁö (ÀÔ·Â ÇÊµå´Â ½ºÅ¸ÀÏ·Î ¿¹¿Ü Ã³¸®)
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    // ÀÔ·Â ÇÊµå´Â ¼±ÅÃ °¡´ÉÇÏµµ·Ï ½ºÅ¸ÀÏ Ãß°¡
    const style = document.createElement("style");
    style.textContent = `
      input, textarea, [contenteditable="true"] {
        user-select: text !important;
        -webkit-user-select: text !important;
      }
    `;
    document.head.appendChild(style);

    // Å°º¸µå ´ÜÃàÅ° Â÷´Ü (ÀÔ·Â ÇÊµå¿¡¼­´Â ÆíÁý ´ÜÃàÅ° Çã¿ë)
    const blockKeys = (e: KeyboardEvent) => {
      const target = e.target;
      const isInput = isInputField(target);

      // ÀÔ·Â ÇÊµå¿¡¼­´Â ±âº» ÆíÁý ´ÜÃàÅ° Çã¿ë
      // Ctrl+C (º¹»ç), Ctrl+V (ºÙ¿©³Ö±â), Ctrl+X (Àß¶ó³»±â), Ctrl+A (ÀüÃ¼¼±ÅÃ)
      // Ctrl+Z (µÇµ¹¸®±â), Ctrl+Y (´Ù½Ã½ÇÇà), Ctrl+Shift+Z (´Ù½Ã½ÇÇà)
      if (isInput) {
        // ÀÔ·Â ÇÊµå¿¡¼­ Çã¿ëÇÒ ´ÜÃàÅ°
        const allowedKeys = [
          "c",
          "v",
          "x",
          "a",
          "z",
          "y",
          "C",
          "V",
          "X",
          "A",
          "Z",
          "Y",
        ];
        const key = e.key.toLowerCase();

        // Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z´Â Ç×»ó Çã¿ë
        if (e.ctrlKey && !e.shiftKey && (key === "z" || key === "y")) {
          return; // ÀÌº¥Æ® Á¤»ó ÁøÇà
        }
        if (e.ctrlKey && e.shiftKey && key === "z") {
          return; // ÀÌº¥Æ® Á¤»ó ÁøÇà
        }

        // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A´Â Shift ¾øÀ» ¶§¸¸ Çã¿ë
        if (e.ctrlKey && !e.shiftKey && allowedKeys.includes(e.key)) {
          return; // ÀÌº¥Æ® Á¤»ó ÁøÇà (º¹»ç/ºÙ¿©³Ö±â/Àß¶ó³»±â/ÀüÃ¼¼±ÅÃ)
        }
      }

      // ÀúÀå/ÀÎ¼â/Ä¸Ã³ °ü·Ã Å°´Â ¸ðµç °÷¿¡¼­ Â÷´Ü

      // Ctrl+S (ÆäÀÌÁö ÀúÀå) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.ctrlKey && !e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+P (ÀÎ¼â) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.ctrlKey && !e.shiftKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+S (ÆäÀÌÁö ÀúÀå/½ºÅ©·Ñ Ä¸Ã³) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.ctrlKey && e.shiftKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+C (Á÷Á¢ ÁöÁ¤ Ä¸Ã³) - ÀÔ·Â ÇÊµå Á¦¿ÜÇÏ°í Â÷´Ü
      if (
        !isInput &&
        e.ctrlKey &&
        e.shiftKey &&
        (e.key === "c" || e.key === "C")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+W (Ã¢ Ä¸Ã³) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.ctrlKey && e.shiftKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+D (´ÜÀ§¿µ¿ª Ä¸Ã³) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.ctrlKey && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+A (ÀüÃ¼Ä¸Ã³) - ÀÔ·Â ÇÊµå Á¦¿ÜÇÏ°í Â÷´Ü
      if (
        !isInput &&
        e.ctrlKey &&
        e.shiftKey &&
        (e.key === "a" || e.key === "A")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+F (ÁöÁ¤»çÀÌÁî Ä¸Ã³) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.ctrlKey && e.shiftKey && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // PrintScreen Å° - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.key === "PrintScreen") {
        e.preventDefault();
        e.stopPropagation();
        // Å¬¸³º¸µå Áö¿ì±â ½Ãµµ
        if (navigator.clipboard) {
          navigator.clipboard.writeText("").catch(() => {});
        }
        return false;
      }
      // Win+Shift+S (Windows ½ºÅ©¸°¼¦ µµ±¸) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.shiftKey && e.metaKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // F12 (°³¹ßÀÚ µµ±¸) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.key === "F12") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Ctrl+Shift+I (°³¹ßÀÚ µµ±¸) - ¸ðµç °÷¿¡¼­ Â÷´Ü
      if (e.ctrlKey && e.shiftKey && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };
    document.addEventListener("keydown", blockKeys, { capture: true });
    document.addEventListener("keyup", blockKeys, { capture: true });

    // Å¬¸°¾÷
    return () => {
      document.removeEventListener("contextmenu", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("selectstart", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("dragstart", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("copy", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("cut", preventDefaultExceptInput, {
        capture: true,
      });
      document.removeEventListener("mousedown", blockRightClick, {
        capture: true,
      });
      document.removeEventListener("mouseup", blockRightClick, {
        capture: true,
      });
      document.removeEventListener("keydown", blockKeys, { capture: true });
      document.removeEventListener("keyup", blockKeys, { capture: true });
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      // Ãß°¡ÇÑ ½ºÅ¸ÀÏ Á¦°Å
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  const openImageInNewWindow = useCallback(
    (imageData: string, title: string = "ÀÌ¹ÌÁö º¸±â") => {
      const imageSrc = imageData.startsWith("data:image")
        ? imageData
        : `data:image/png;base64,${imageData}`;
      const imageWindow = window.open(
        "",
        "_blank",
        "width=900,height=700,scrollbars=yes,resizable=yes"
      );
      if (!imageWindow) return;

      imageWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: #0f172a;
            color: #e2e8f0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
          }
          img {
            max-width: 100%;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          }
          h1 {
            font-size: 18px;
            margin: 0 0 16px;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <img src="${imageSrc}" alt="${title}" />
      </body>
      </html>
    `);
      imageWindow.document.close();
    },
    []
  );

  const checkAndReplaceContent = useCallback(
    (text: string) => {
      const unsafeWords = detectUnsafeWords(text);
      if (unsafeWords.length > 0) {
        const { replacements } = replaceUnsafeWords(text);
        setContentWarning({ unsafeWords, replacements });
        setHasContentWarning(true);
        return isContentWarningAcknowledged;
      }
      setContentWarning(null);
      setHasContentWarning(false);
      return true;
    },
    [isContentWarningAcknowledged]
  );

  const handleAutoReplace = useCallback(() => {
    if (!contentWarning) return;
    const { replacedText: replacedPersona } = replaceUnsafeWords(personaInput);
    const { replacedText: replacedScript } =
      replaceUnsafeWords(videoSourceScript);
    setPersonaInput(replacedPersona);
    setVideoSourceScript(replacedScript);
    setContentWarning(null);
    setHasContentWarning(false);
    setIsContentWarningAcknowledged(true);
  }, [contentWarning, personaInput, videoSourceScript]);

  const handleAcknowledgeWarning = useCallback(() => {
    setIsContentWarningAcknowledged(true);
  }, []);

  const handleReferenceImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        setError("ÂüÁ¶ ÀÌ¹ÌÁö´Â ÃÖ´ë 10MB±îÁö ¾÷·ÎµåÇÒ ¼ö ÀÖ½À´Ï´Ù.");
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        setReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleRemoveReferenceImage = useCallback(() => {
    setReferenceImage(null);
  }, []);

  const handleCameraAngleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        setCameraAngleError("¿øº» ÀÌ¹ÌÁö´Â ÃÖ´ë 10MB±îÁö ¾÷·ÎµåÇÒ ¼ö ÀÖ½À´Ï´Ù.");
        event.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setCameraAngleSourceImage(result);
        setCameraAngles([]);
        setCameraAngleError(null);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleGeneratePersonas = useCallback(async () => {
    if (!apiKey.trim()) {
      setPersonaError(
        "¼­¹ö API Å°°¡ ¼³Á¤µÇÁö ¾Ê¾Ò½À´Ï´Ù. °ü¸®ÀÚ¿¡°Ô ¹®ÀÇÇØÁÖ¼¼¿ä."
      );
      return;
    }
    if (!personaInput.trim()) {
      setPersonaError("Æä¸£¼Ò³ª ¼³¸íÀÌ³ª ´ëº»À» ÀÔ·ÂÇØÁÖ¼¼¿ä.");
      return;
    }

    const isSafe = checkAndReplaceContent(personaInput);
    if (!isSafe) {
      setIsContentWarningAcknowledged(false);
      return;
    }

    setIsLoadingCharacters(true);
    setPersonaError(null);
    setCharacters([]);
    setLoadingProgress("Æä¸£¼Ò³ª ºÐ¼® Áß...");

    try {
      const generatedCharacters = await generateCharacters(
        personaInput,
        apiKey,
        imageStyle,
        aspectRatio,
        personaStyle,
        customStyle,
        photoComposition,
        customPrompt,
        characterStyle,
        backgroundStyle,
        customCharacterStyle,
        customBackgroundStyle,
        personaReferenceImage,
        (progress) => setLoadingProgress(progress)
      );

      if (generatedCharacters.length === 0) {
        setPersonaError(
          "Æä¸£¼Ò³ª »ý¼º¿¡ ½ÇÆÐÇß½À´Ï´Ù. ÀÔ·ÂÀ» ¹Ù²ã ´Ù½Ã ½ÃµµÇØÁÖ¼¼¿ä."
        );
      } else {
        setCharacters(generatedCharacters);
        setPersonaError(`? Æä¸£¼Ò³ª ${generatedCharacters.length}°³ »ý¼º ¿Ï·á`);
        setTimeout(() => saveDataToStorage(true), 100);
      }
    } catch (e) {
      console.error("[°³¹ßÀÚ¿ë] Æä¸£¼Ò³ª »ý¼º ¿À·ù:", e);
      const message =
        e instanceof Error
          ? e.message
          : "Æä¸£¼Ò³ª »ý¼º Áß ¿À·ù°¡ ¹ß»ýÇß½À´Ï´Ù.";
      setPersonaError(message);
    } finally {
      setIsLoadingCharacters(false);
      setLoadingProgress("");
    }
  }, [
    apiKey,
    personaInput,
    imageStyle,
    aspectRatio,
    personaStyle,
    customStyle,
    photoComposition,
    customPrompt,
    characterStyle,
    backgroundStyle,
    customCharacterStyle,
    customBackgroundStyle,
    personaReferenceImage,
    checkAndReplaceContent,
    saveDataToStorage,
  ]);

  const handleRegenerateCharacter = useCallback(
    async (
      characterId: string,
      description: string,
      name: string,
      customPrompt?: string
    ) => {
      if (!apiKey.trim()) {
        setPersonaError(
          "¼­¹ö API Å°°¡ ¼³Á¤µÇÁö ¾Ê¾Ò½À´Ï´Ù. °ü¸®ÀÚ¿¡°Ô ¹®ÀÇÇØÁÖ¼¼¿ä."
        );
        return;
      }
      try {
        const mergedDescription = customPrompt
          ? `${description}\nÃß°¡ ¿äÃ»: ${customPrompt}`
          : description;
        const newImage = await regenerateCharacterImage(
          mergedDescription,
          name,
          apiKey,
          imageStyle,
          aspectRatio,
          personaStyle
        );
        setCharacters((prev) =>
          prev.map((char) =>
            char.id === characterId ? { ...char, image: newImage } : char
          )
        );
        setPersonaError(`? ${name} ÀÌ¹ÌÁö°¡ ¾÷µ¥ÀÌÆ®µÇ¾ú½À´Ï´Ù.`);
        setTimeout(() => saveDataToStorage(true), 100);
      } catch (e) {
        console.error("[°³¹ßÀÚ¿ë] Æä¸£¼Ò³ª Àç»ý¼º ¿À·ù:", e);
        const message =
          e instanceof Error ? e.message : "Æä¸£¼Ò³ª Àç»ý¼º¿¡ ½ÇÆÐÇß½À´Ï´Ù.";
        setPersonaError(message);
      }
    },
    [apiKey, imageStyle, aspectRatio, personaStyle, saveDataToStorage]
  );

  const handleGenerateVideoSource = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("¼­¹ö API Å°°¡ ¼³Á¤µÇÁö ¾Ê¾Ò½À´Ï´Ù. °ü¸®ÀÚ¿¡°Ô ¹®ÀÇÇØÁÖ¼¼¿ä.");
      return;
    }
    if (!videoSourceScript.trim()) {
      setError("¿µ»ó ¼Ò½º ´ëº»À» ÀÔ·ÂÇØÁÖ¼¼¿ä.");
      return;
    }
    if (characters.length === 0 && !referenceImage) {
      setError("Æä¸£¼Ò³ª¸¦ »ý¼ºÇÏ°Å³ª ÂüÁ¶ ÀÌ¹ÌÁö¸¦ ¾÷·ÎµåÇØÁÖ¼¼¿ä.");
      return;
    }

    const isSafe = checkAndReplaceContent(videoSourceScript);
    if (!isSafe) {
      setIsContentWarningAcknowledged(false);
      return;
    }

    setIsLoadingVideoSource(true);
    setError(null);
    setVideoSource([]);
    setLoadingProgress("´ëº» ºÐ¼® Áß...");

    try {
      const generatedVideoSource = await generateStoryboard(
        videoSourceScript,
        characters,
        imageCount,
        apiKey,
        imageStyle,
        subtitleEnabled,
        referenceImage,
        aspectRatio,
        (progress) => setLoadingProgress(progress)
      );

      setVideoSource(generatedVideoSource);
      setTimeout(() => saveDataToStorage(true), 100);
    } catch (e) {
      console.error("[°³¹ßÀÚ¿ë] ¿µ»ó ¼Ò½º »ý¼º ¿À·ù:", e);
      const message =
        e instanceof Error
          ? e.message
          : "¿µ»ó ¼Ò½º »ý¼º Áß ¿À·ù°¡ ¹ß»ýÇß½À´Ï´Ù.";
      setError(message);
    } finally {
      setIsLoadingVideoSource(false);
      setLoadingProgress("");
    }
  }, [
    apiKey,
    videoSourceScript,
    characters,
    imageCount,
    imageStyle,
    subtitleEnabled,
    referenceImage,
    aspectRatio,
    checkAndReplaceContent,
    saveDataToStorage,
  ]);

  const handleRegenerateVideoSourceImage = useCallback(
    async (storyboardItemId: string, customPrompt?: string) => {
      if (!apiKey.trim()) {
        setError("¼­¹ö API Å°°¡ ¼³Á¤µÇÁö ¾Ê¾Ò½À´Ï´Ù. °ü¸®ÀÚ¿¡°Ô ¹®ÀÇÇØÁÖ¼¼¿ä.");
        return;
      }

      const target = videoSource.find((item) => item.id === storyboardItemId);
      if (!target) return;

      try {
        const mergedScene = customPrompt
          ? `${target.sceneDescription}\nÃß°¡ ¿äÃ»: ${customPrompt}`
          : target.sceneDescription;
        const newImage = await regenerateStoryboardImage(
          mergedScene,
          characters,
          apiKey,
          imageStyle,
          subtitleEnabled,
          referenceImage,
          aspectRatio
        );

        setVideoSource((prev) =>
          prev.map((item) =>
            item.id === storyboardItemId ? { ...item, image: newImage } : item
          )
        );
        setTimeout(() => saveDataToStorage(true), 100);
      } catch (e) {
        console.error("[°³¹ßÀÚ¿ë] ¿µ»ó ¼Ò½º Àç»ý¼º ¿À·ù:", e);
        const message =
          e instanceof Error ? e.message : "¿µ»ó ¼Ò½º Àç»ý¼º¿¡ ½ÇÆÐÇß½À´Ï´Ù.";
        setError(message);
      }
    },
    [
      apiKey,
      videoSource,
      characters,
      imageStyle,
      subtitleEnabled,
      referenceImage,
      aspectRatio,
      saveDataToStorage,
    ]
  );

  const handleGenerateCameraAngles = useCallback(async () => {
    if (!apiKey.trim()) {
      setCameraAngleError(
        "¼­¹ö API Å°°¡ ¼³Á¤µÇÁö ¾Ê¾Ò½À´Ï´Ù. °ü¸®ÀÚ¿¡°Ô ¹®ÀÇÇØÁÖ¼¼¿ä."
      );
      return;
    }
    if (!cameraAngleSourceImage) {
      setCameraAngleError("¿øº» ÀÌ¹ÌÁö¸¦ ¾÷·ÎµåÇØÁÖ¼¼¿ä.");
      return;
    }
    if (selectedCameraAngles.length === 0) {
      setCameraAngleError("»ý¼ºÇÒ ¾Þ±ÛÀ» ÃÖ¼Ò 1°³ ÀÌ»ó ¼±ÅÃÇØÁÖ¼¼¿ä.");
      return;
    }

    setIsLoadingCameraAngles(true);
    setCameraAngleError(null);
    setCameraAngles([]);
    setCameraAngleProgress("¿øº» ÀÌ¹ÌÁö ºÐ¼® Áß...");

    try {
      const generatedAngles = await generateCameraAngles(
        cameraAngleSourceImage,
        selectedCameraAngles,
        apiKey,
        aspectRatio,
        (message, current, total) => {
          setCameraAngleProgress(`${message} (${current}/${total})`);
        }
      );

      setCameraAngles(generatedAngles);
      setTimeout(() => saveDataToStorage(true), 100);

      const successCount = generatedAngles.filter(
        (angle) => angle.image && angle.image.trim() !== ""
      ).length;
      const totalSelected = selectedCameraAngles.length;

      if (successCount === 0) {
        setCameraAngleError(
          "¸ðµç ¾Þ±Û »ý¼º¿¡ ½ÇÆÐÇß½À´Ï´Ù. Àá½Ã ÈÄ ´Ù½Ã ½ÃµµÇØÁÖ¼¼¿ä."
        );
      } else if (successCount < totalSelected) {
        setCameraAngleError(
          `?? ${successCount}/${totalSelected}°³ ¾Þ±Û¸¸ »ý¼ºµÇ¾ú½À´Ï´Ù. ½ÇÆÐÇÑ ¾Þ±ÛÀº ´Ù½Ã ½ÃµµÇØÁÖ¼¼¿ä.`
        );
      }
    } catch (e) {
      console.error("[°³¹ßÀÚ¿ë] Ä«¸Þ¶ó ¾Þ±Û »ý¼º ¿À·ù:", e);
      const message =
        e instanceof Error
          ? e.message
          : "Ä«¸Þ¶ó ¾Þ±Û »ý¼º Áß ¿À·ù°¡ ¹ß»ýÇß½À´Ï´Ù.";
      setCameraAngleError(message);
    } finally {
      setIsLoadingCameraAngles(false);
      setCameraAngleProgress("");
    }
  }, [
    apiKey,
    cameraAngleSourceImage,
    selectedCameraAngles,
    aspectRatio,
    saveDataToStorage,
  ]);

  const handleResetAll = useCallback(() => {
    try {
      localStorage.removeItem("youtube_image_work_data");
    } catch (storageError) {
      console.error("? localStorage Á¤¸® ½ÇÆÐ:", storageError);
    }
    try {
      sessionStorage.removeItem("youtube_image_work_data");
    } catch (storageError) {
      console.error("? sessionStorage Á¤¸® ½ÇÆÐ:", storageError);
    }

    setCharacters([]);
    setVideoSource([]);
    setPersonaInput("");
    setVideoSourceScript("");
    setPersonaReferenceImage(null);
    setReferenceImage(null);
    setImageStyle("realistic");
    setPersonaStyle("½Ç»ç ±Ø´ëÈ­");
    setCharacterStyle("½Ç»ç ±Ø´ëÈ­");
    setBackgroundStyle("¸ð´ø");
    setCustomCharacterStyle("");
    setCustomBackgroundStyle("");
    setCustomStyle("");
    setPhotoComposition("Á¤¸é");
    setCustomPrompt("");
    setAspectRatio("16:9");
    setImageCount(5);
    setSubtitleEnabled(false);
    setError(null);
    setPersonaError(null);
    setContentWarning(null);
    setHasContentWarning(false);
    setIsContentWarningAcknowledged(false);
    setHoveredStyle(null);
    setCameraAngleSourceImage(null);
    setSelectedCameraAngles([
      "Front View",
      "Right Side View",
      "Left Side View",
      "Back View",
      "Full Body",
      "Close-up Face",
    ]);
    setCameraAngles([]);
    setCameraAngleError(null);
    setCameraAngleProgress("");
  }, []);

  const handleDownloadAllImages = useCallback(async () => {
    if (videoSource.length === 0) return;

    setIsDownloading(true);
    setError(null);
    
    let successCount = 0;
    let cancelCount = 0;
    
    try {
      // °¢ ÀÌ¹ÌÁö¸¦ ¼øÂ÷ÀûÀ¸·Î ´Ù¿î·Îµå
      for (let index = 0; index < videoSource.length; index++) {
        const item = videoSource[index];
        const safeDescription = item.sceneDescription
          .replace(/[^a-zA-Z0-9¤¡-¤¾¤¿-¤Ó°¡-ÆR]/g, "_")
          .substring(0, 30);
        const fileName = `Àå¸é_${index + 1}_${safeDescription}.jpg`;
        
        try {
          // Base64¸¦ BlobÀ¸·Î º¯È¯
          const base64Response = await fetch(`data:image/jpeg;base64,${item.image}`);
          const blob = await base64Response.blob();
          
          // File System Access API Áö¿ø È®ÀÎ
          if ('showSaveFilePicker' in window) {
            try {
              const handle = await (window as any).showSaveFilePicker({
                suggestedName: fileName,
                types: [
                  {
                    description: 'ÀÌ¹ÌÁö ÆÄÀÏ',
                    accept: {
                      'image/jpeg': ['.jpg', '.jpeg'],
                    },
                  },
                ],
              });
              
              const writable = await handle.createWritable();
              await writable.write(blob);
              await writable.close();
              successCount++;
            } catch (err: any) {
              if (err.name === 'AbortError') {
                // »ç¿ëÀÚ°¡ ÀÌ ÆÄÀÏ ÀúÀåÀ» Ãë¼ÒÇÔ
                cancelCount++;
                console.log(`[${index + 1}/${videoSource.length}] »ç¿ëÀÚ°¡ ÀúÀåÀ» Ãë¼ÒÇß½À´Ï´Ù.`);
              } else {
                throw err;
              }
            }
          } else {
            // Æú¹é: ±âÁ¸ ´Ù¿î·Îµå ¹æ½Ä
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            successCount++;
            
            // ÀÚµ¿ ´Ù¿î·Îµå ½Ã ¾à°£ÀÇ µô·¹ÀÌ
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (err) {
          console.error(`[°³¹ßÀÚ¿ë] ÀÌ¹ÌÁö ${index + 1} ´Ù¿î·Îµå ¿À·ù:`, err);
          throw err;
        }
      }
      
      // ´Ù¿î·Îµå ¿Ï·á ¸Þ½ÃÁö
      if (successCount > 0) {
        setError(`? ${successCount}°³ÀÇ ÀÌ¹ÌÁö°¡ ÀúÀåµÇ¾ú½À´Ï´Ù!` + 
                (cancelCount > 0 ? ` (${cancelCount}°³ Ãë¼ÒµÊ)` : ''));
      } else if (cancelCount > 0) {
        setError(`¸ðµç ´Ù¿î·Îµå°¡ Ãë¼ÒµÇ¾ú½À´Ï´Ù.`);
      }
    } catch (e) {
      console.error("[°³¹ßÀÚ¿ë] ÀÌ¹ÌÁö ´Ù¿î·Îµå ¿À·ù:", e);
      
      // »ç¿ëÀÚ¿ë ¿À·ù ¸Þ½ÃÁö
      let userMessage = "ÆÄÀÏ ´Ù¿î·Îµå¿¡ ½ÇÆÐÇß½À´Ï´Ù. ´Ù½Ã ½ÃµµÇØ ÁÖ¼¼¿ä.";
      
      if (e instanceof Error) {
        console.error(`[°³¹ßÀÚ¿ë] ¿À·ù »ó¼¼: ${e.name} - ${e.message}`);
        
        if (e.name === 'NotAllowedError') {
          userMessage = "ÆÄÀÏ ÀúÀå ±ÇÇÑÀÌ °ÅºÎµÇ¾ú½À´Ï´Ù. ºê¶ó¿ìÀú ¼³Á¤À» È®ÀÎÇØ ÁÖ¼¼¿ä.";
        } else if (e.name === 'SecurityError') {
          userMessage = "º¸¾È ¹®Á¦·Î ÆÄÀÏÀ» ÀúÀåÇÒ ¼ö ¾ø½À´Ï´Ù. ºê¶ó¿ìÀú¸¦ ¾÷µ¥ÀÌÆ®ÇÏ°Å³ª ´Ù¸¥ ºê¶ó¿ìÀú¸¦ »ç¿ëÇØ ÁÖ¼¼¿ä.";
        }
      }
      
      setError(userMessage);
    } finally {
      setIsDownloading(false);
    }
  }, [videoSource]);

  // ¶ó¿ìÆÃ Ã³¸®
  if (currentView === "user-guide") {
    return (
      <>
        <MetaTags
          title="À¯Æ©ºê ÀÌ¹ÌÁö »ý¼º±â »ç¿ë¹ý °¡ÀÌµå - AI·Î ÄÜÅÙÃ÷ Á¦ÀÛÇÏ±â"
          description="AI¸¦ È°¿ëÇÏ¿© À¯Æ©ºê Æä¸£¼Ò³ª¿Í ¿µ»ó ¼Ò½º¸¦ »ý¼ºÇÏ´Â ¹æ¹ýÀ» »ó¼¼È÷ ¾Ë·Áµå¸³´Ï´Ù. ´Ü°èº° °¡ÀÌµå·Î ½±°Ô µû¶óÇÏ¼¼¿ä."
          url={`${normalizedBasePath || "/image"}/user-guide`}
          image="/user-guide-preview.png"
          type="article"
        />
        <UserGuide
          onBack={() => navigateToView("main")}
        />
      </>
    );
  }

  return (
    <>
      <AdBlockDetector />
      <MetaTags
        title="À¯Æ©ºê ·ÕÆû ÀÌ¹ÌÁö »ý¼º±â - AI·Î Ä³¸¯ÅÍ¿Í ½ºÅä¸®º¸µå ¸¸µé±â"
        description="Google Gemini AI¸¦ È°¿ëÇØ À¯Æ©ºê ÄÜÅÙÃ÷¿ë Æä¸£¼Ò³ª¿Í ¿µ»ó ¼Ò½º¸¦ ½±°í ºü¸£°Ô »ý¼ºÇÏ¼¼¿ä. ´Ù¾çÇÑ ºñÀ²(9:16, 16:9, 1:1) Áö¿ø."
        url={normalizedBasePath || "/image"}
        image="/og-image.png"
        type="website"
      />
      <SideFloatingAd side="left" />
      <SideFloatingAd side="right" />
      <div
        className="min-h-screen bg-gray-900 text-white font-sans p-4 sm:p-6 lg:p-8"
        style={{ paddingBottom: "120px" }}
      >
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">
              À¯Æ©ºê ·ÕÆû ÀÌ¹ÌÁö »ý¼º±â
            </h1>
            <p className="mt-2 text-lg text-gray-400">
              ½ºÅ©¸³Æ®¸¦ ÀÔ·ÂÇÏ°í ÀÏ°üµÈ Ä³¸¯ÅÍ¿Í ¿µ»ó ¼Ò½º ÀÌ¹ÌÁö¸¦ »ý¼ºÇÏ¼¼¿ä!
            </p>

            {/* µ¥ÀÌÅÍ º¹¿ø ¾È³» (º¹¿øµÈ µ¥ÀÌÅÍ°¡ ÀÖÀ» ¶§¸¸ Ç¥½Ã) */}
            {(characters.length > 0 || videoSource.length > 0 || cameraAngles.length > 0) && (
              <div className="mt-4 bg-green-900/20 border border-green-500/50 rounded-lg p-3 max-w-2xl mx-auto">
                <p className="text-green-300 text-sm flex items-center justify-center">
                  <span className="mr-2">??</span>
                  ÀÌÀü ÀÛ¾÷ÀÌ º¹¿øµÇ¾ú½À´Ï´Ù:
                  {characters.length > 0 && ` Æä¸£¼Ò³ª ${characters.length}°³`}
                  {videoSource.length > 0 && ` | ¿µ»ó¼Ò½º ${videoSource.length}°³`}
                  {cameraAngles.length > 0 && ` | Ä«¸Þ¶ó¾Þ±Û ${cameraAngles.length}°³`}
                </p>
              </div>
            )}

            {/* ³×ºñ°ÔÀÌ¼Ç ¸µÅ© */}
            <div className="flex justify-center mt-4 space-x-4">
              <button
                onClick={() => navigateToView("user-guide")}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors"
              >
                ?? »ç¿ë¹ý °¡ÀÌµå
              </button>
            </div>
          </header>

          <main className="space-y-6">
            <AdBanner />

            <section className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-blue-500">
              <h2 className="text-2xl font-bold mb-4 text-blue-400 flex items-center">
                <span className="mr-2">1??</span>
                Æä¸£¼Ò³ª »ý¼º
              </h2>
              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-3">
                  ±¸Ã¼ÀûÀÎ ÀÎ¹° ¹¦»ç¸¦ ÀÔ·ÂÇÏ°Å³ª, ´ëº»À» ³ÖÀ¸¸é µîÀåÀÎ¹°µéÀ»
                  ÀÚµ¿À¸·Î ºÐ¼®ÇÏ¿© »ý¼ºÇÕ´Ï´Ù.
                </p>
                <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4 mb-4">
                  <p className="text-blue-200 text-sm mb-2">
                    <strong>ÀÔ·Â ¿¹½Ã:</strong>
                  </p>
                  <ul className="text-blue-300 text-sm space-y-1 ml-4">
                    <li>
                      ? <strong>ÀÎ¹° ¹¦»ç:</strong> "20´ë Áß¹Ý ¿©¼º, ±ä Èæ¹ß,
                      ¹àÀº ¹Ì¼Ò, Ä³ÁÖ¾óÇÑ ¿ÊÂ÷¸²"
                    </li>
                    <li>
                      ? <strong>´ëº» ÀÔ·Â:</strong> ÀüÃ¼ ½ºÅä¸® ´ëº»À» ³ÖÀ¸¸é
                      µîÀåÀÎ¹° ÀÚµ¿ ÃßÃâ
                    </li>
                  </ul>
                </div>
              </div>
              <textarea
                value={personaInput}
                onChange={(e) => setPersonaInput(e.target.value)}
                placeholder="ÀÎ¹° ¹¦»ç³ª ´ëº»À» ÀÔ·ÂÇÏ¼¼¿ä..."
                className="w-full h-48 p-4 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 resize-y mb-6"
              />

              {/* ÀÌ¹ÌÁö ½ºÅ¸ÀÏ ¼±ÅÃ */}
              <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-6">
                <h3 className="text-blue-300 font-medium mb-6 flex items-center">
                  <span className="mr-2">??</span>
                  ÀÌ¹ÌÁö ½ºÅ¸ÀÏ ¼±ÅÃ
                </h3>

                {/* ÀÎ¹° ½ºÅ¸ÀÏ */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-blue-200 font-medium flex items-center text-sm">
                      <span className="mr-2">??</span>
                      ÀÎ¹° ½ºÅ¸ÀÏ
                    </h4>
                    <button
                      onClick={() => setCharacterStyle("custom")}
                      className={`py-1.5 px-4 rounded-lg font-medium text-xs transition-all duration-200 ${
                        characterStyle === "custom"
                          ? "bg-blue-600 text-white shadow-lg scale-105"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      Á÷Á¢ ÀÔ·Â
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(
                      [
                        "½Ç»ç ±Ø´ëÈ­",
                        "¾Ö´Ï¸ÞÀÌ¼Ç",
                        "µ¿¹°",
                        "À¥Å÷",
                      ] as CharacterStyle[]
                    ).map((style) => {
                      const styleDescriptions: Record<CharacterStyle, string> =
                        {
                          "½Ç»ç ±Ø´ëÈ­":
                            "?? ÃÊÇö½ÇÀûÀÌ°í »çÁø °°Àº Ä÷¸®Æ¼ÀÇ ½Ç»ç ÀÎ¹°",
                          ¾Ö´Ï¸ÞÀÌ¼Ç: "?? ¹à°í È­·ÁÇÑ ¾Ö´Ï¸ÞÀÌ¼Ç ½ºÅ¸ÀÏ Ä³¸¯ÅÍ",
                          µ¿¹°: "?? ±Í¿©¿î µ¿¹° Ä³¸¯ÅÍ·Î º¯È¯",
                          À¥Å÷: "?? ±ú²ýÇÑ ¼±°ú Ç¥Çö·Â Ç³ºÎÇÑ ÇÑ±¹ À¥Å÷ ½ºÅ¸ÀÏ",
                          custom: "",
                        };

                      return (
                        <div key={style} className="relative group">
                          <button
                            onClick={() => setCharacterStyle(style)}
                            onMouseEnter={() =>
                              setHoveredStyle(`character-${style}`)
                            }
                            onMouseLeave={() => setHoveredStyle(null)}
                            className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                              characterStyle === style
                                ? "bg-blue-600 text-white shadow-lg scale-105"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105"
                            }`}
                          >
                            {style}
                          </button>
                          {hoveredStyle === `character-${style}` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                              <div className="bg-gray-900 rounded-lg shadow-2xl border border-blue-500/50 overflow-hidden" style={{ minWidth: '500px' }}>
                                <div className="p-3">
                                  <div className="text-blue-200 font-medium text-sm mb-2 text-center">
                                    {style} ¹Ì¸®º¸±â
                                  </div>
                                  <img
                                    src={`/${style}.png`}
                                    alt={`${style} ½ºÅ¸ÀÏ ¹Ì¸®º¸±â`}
                                    className="w-full h-auto object-contain rounded"
                                    style={{ maxHeight: '400px', minHeight: '300px' }}
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const fallback =
                                          document.createElement("div");
                                        fallback.className =
                                          "w-full bg-gray-800 rounded flex items-center justify-center text-blue-300 text-sm text-center p-4";
                                        fallback.style.minHeight = "300px";
                                        fallback.textContent =
                                          styleDescriptions[style];
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                  <div className="text-gray-300 text-xs mt-2 text-center px-2">
                                    {styleDescriptions[style]}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {characterStyle === "custom" && (
                    <input
                      type="text"
                      value={customCharacterStyle}
                      onChange={(e) => setCustomCharacterStyle(e.target.value)}
                      placeholder="¿øÇÏ´Â ÀÎ¹° ½ºÅ¸ÀÏÀ» ÀÔ·ÂÇÏ¼¼¿ä (¿¹: ¸£³×»ó½º, ºòÅä¸®¾Æ ½Ã´ë µî)"
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mt-3"
                    />
                  )}
                </div>

                {/* ¹è°æ/ºÐÀ§±â ½ºÅ¸ÀÏ */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-blue-200 font-medium flex items-center text-sm">
                      <span className="mr-2">??</span>
                      ¹è°æ/ºÐÀ§±â ½ºÅ¸ÀÏ
                    </h4>
                    <button
                      onClick={() => setBackgroundStyle("custom")}
                      className={`py-1.5 px-4 rounded-lg font-medium text-xs transition-all duration-200 ${
                        backgroundStyle === "custom"
                          ? "bg-blue-600 text-white shadow-lg scale-105"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      Á÷Á¢ ÀÔ·Â
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                    {(
                      [
                        "°¨¼º ¸á·Î",
                        "¼­ºÎ±Ø",
                        "°øÆ÷ ½º¸±·¯",
                        "»çÀÌ¹öÆãÅ©",
                        "ÆÇÅ¸Áö",
                        "¹Ì´Ï¸Ö",
                        "ºóÆ¼Áö",
                        "¸ð´ø",
                        "1980³â´ë",
                        "2000³â´ë",
                        "¸Ô¹æ",
                        "±Í¿©¿ò",
                        "AI",
                        "±«ÀÌÇÔ",
                        "Ã¢ÀÇÀûÀÎ",
                        "Á¶¼±½Ã´ë",
                      ] as BackgroundStyle[]
                    ).map((style) => {
                      const styleDescriptions: Record<BackgroundStyle, string> =
                        {
                          "°¨¼º ¸á·Î": "?? ·Î¸ÇÆ½ÇÏ°í °¨¼ºÀûÀÎ µû¶æÇÑ ºÐÀ§±â",
                          ¼­ºÎ±Ø: "?? °ÅÄ£ »ç¸·°ú Ä«¿ìº¸ÀÌ ¹è°æ",
                          "°øÆ÷ ½º¸±·¯": "?? ¹Ì½ºÅÍ¸®ÇÏ°í ±äÀå°¨ ÀÖ´Â ºÐÀ§±â",
                          »çÀÌ¹öÆãÅ©: "?? ³×¿Â»çÀÎ °¡µæÇÑ ¹Ì·¡ µµ½Ã",
                          ÆÇÅ¸Áö: "???¡Î? ¸¶¹ýÀûÀÌ°í ½Åºñ·Î¿î Áß¼¼ ¹è°æ",
                          ¹Ì´Ï¸Ö: "? ±ò²ûÇÏ°í ´Ü¼øÇÑ Áß¼ºÅæ ¹è°æ",
                          ºóÆ¼Áö: "?? Å¬·¡½ÄÇÏ°í Çâ¼ö¸¦ ÀÚ¾Æ³»´Â ¹è°æ",
                          ¸ð´ø: "?? Çö´ëÀûÀÌ°í ¼¼·ÃµÈ µµ½Ã ¹è°æ",
                          "1980³â´ë": "?? 80³â´ë ·¹Æ®·Î ÆÐ¼Ç°ú ºÐÀ§±â",
                          "2000³â´ë": "?? 2000³â´ë ÃÊ¹Ý °¨¼º°ú ½ºÅ¸ÀÏ",
                          ¸Ô¹æ: "??? ¸ÀÀÖ´Â À½½ÄÀÌ °¡µæÇÑ ¸Ô¹æ ºÐÀ§±â",
                          ±Í¿©¿ò: "?? ±Í¿±°í »ç¶û½º·¯¿î ÆÄ½ºÅÚ °¨¼º",
                          AI: "?? ¹Ì·¡ÁöÇâÀûÀÎ ÇÏÀÌÅ×Å© AI ºÐÀ§±â",
                          ±«ÀÌÇÔ: "??? µ¶Æ¯ÇÏ°í ÃÊÇö½ÇÀûÀÎ ±â¹¦ÇÑ ºÐÀ§±â",
                          Ã¢ÀÇÀûÀÎ: "?? »ó»ó·Â ³ÑÄ¡´Â µ¶Ã¢ÀûÀÎ ¿¹¼ú ºÐÀ§±â",
                          Á¶¼±½Ã´ë: "?? ÇÑ¿Á°ú ÀüÅë °¡¿Á, µû¶æÇÏ°í °¨¼ºÀûÀÎ Á¶¼± ºÐÀ§±â",
                          custom: "",
                        };

                      return (
                        <div key={style} className="relative group">
                          <button
                            onClick={() => setBackgroundStyle(style)}
                            onMouseEnter={() =>
                              setHoveredStyle(`background-${style}`)
                            }
                            onMouseLeave={() => setHoveredStyle(null)}
                            className={`w-full py-2 px-3 rounded-lg font-medium text-sm transition-all duration-200 ${
                              backgroundStyle === style
                                ? "bg-blue-600 text-white shadow-lg scale-105"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600 hover:scale-105"
                            }`}
                          >
                            {style}
                          </button>
                          {hoveredStyle === `background-${style}` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
                              <div className="bg-gray-900 rounded-lg shadow-2xl border border-blue-500/50 overflow-hidden" style={{ minWidth: '500px' }}>
                                <div className="p-3">
                                  <div className="text-blue-200 font-medium text-sm mb-2 text-center">
                                    {style} ¹Ì¸®º¸±â
                                  </div>
                                  <img
                                    src={`/${
                                      style === "AI" ? "ai" : style
                                    }.png`}
                                    alt={`${style} ½ºÅ¸ÀÏ ¹Ì¸®º¸±â`}
                                    className="w-full h-auto object-contain rounded"
                                    style={{ maxHeight: '400px', minHeight: '300px' }}
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const fallback =
                                          document.createElement("div");
                                        fallback.className =
                                          "w-full bg-gray-800 rounded flex items-center justify-center text-blue-300 text-sm text-center p-4";
                                        fallback.style.minHeight = "300px";
                                        fallback.textContent =
                                          styleDescriptions[style];
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                  <div className="text-gray-300 text-xs mt-2 text-center px-2">
                                    {styleDescriptions[style]}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {backgroundStyle === "custom" && (
                    <input
                      type="text"
                      value={customBackgroundStyle}
                      onChange={(e) => setCustomBackgroundStyle(e.target.value)}
                      placeholder="¿øÇÏ´Â ¹è°æ/ºÐÀ§±â¸¦ ÀÔ·ÂÇÏ¼¼¿ä (¿¹: ¿ìÁÖ Á¤°ÅÀå, ¿­´ë ÇØº¯ µî)"
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mt-3"
                    />
                  )}
                </div>
              </div>

              {/* »çÁø ¼³Á¤ (±¸µµ ¹× ºñÀ²) */}
              <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-6">
                <h3 className="text-blue-300 font-medium mb-4 flex items-center">
                  <span className="mr-2">??</span>
                  »çÁø ¼³Á¤
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ¿ÞÂÊ: »çÁø ±¸µµ ¼±ÅÃ */}
                  <div>
                    <label className="block text-blue-200 text-sm font-medium mb-2">
                      »çÁø ±¸µµ
                    </label>
                    <select
                      value={photoComposition}
                      onChange={(e) =>
                        setPhotoComposition(e.target.value as PhotoComposition)
                      }
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-white"
                    >
                      <option value="Á¤¸é">Á¤¸é (±âº»)</option>
                      <option value="Ãø¸é">Ãø¸é</option>
                      <option value="¹ÝÃø¸é">¹ÝÃø¸é</option>
                      <option value="À§¿¡¼­">À§¿¡¼­</option>
                      <option value="¾Æ·¡¿¡¼­">¾Æ·¡¿¡¼­</option>
                      <option value="Àü½Å">Àü½Å</option>
                      <option value="»ó¹Ý½Å">»ó¹Ý½Å</option>
                      <option value="Å¬·ÎÁî¾÷">Å¬·ÎÁî¾÷</option>
                    </select>
                  </div>

                  {/* ¿À¸¥ÂÊ: ÀÌ¹ÌÁö ºñÀ² ¼±ÅÃ */}
                  <div>
                    <label className="block text-blue-200 text-sm font-medium mb-2">
                      ÀÌ¹ÌÁö ºñÀ²
                    </label>
                    <select
                      value={aspectRatio}
                      onChange={(e) =>
                        setAspectRatio(e.target.value as AspectRatio)
                      }
                      className="w-full p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-white"
                    >
                      <option value="9:16">?? 9:16 - ¸ð¹ÙÀÏ ¼¼·Î</option>
                      <option value="16:9">??? 16:9 - µ¥½ºÅ©Åé °¡·Î</option>
                      <option value="1:1">? 1:1 - Á¤»ç°¢Çü</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-gray-400 mt-3">
                  ?? »çÁø ±¸µµ¿Í ÀÌ¹ÌÁö ºñÀ²À» Á¶ÇÕÇÏ¿© ¿øÇÏ´Â ½ºÅ¸ÀÏÀÇ ÀÌ¹ÌÁö¸¦
                  ¸¸µå¼¼¿ä.
                </div>
              </div>

              {/* ½ºÅ¸ÀÏ ÂüÁ¶ ÀÌ¹ÌÁö ¾÷·Îµå (¼±ÅÃ»çÇ×) */}
              <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-6">
                <h3 className="text-blue-300 font-medium mb-4 flex items-center">
                  <span className="mr-2">???</span>
                  ½ºÅ¸ÀÏ ÂüÁ¶ ÀÌ¹ÌÁö (¼±ÅÃ»çÇ×)
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  ¿øÇÏ´Â ½ºÅ¸ÀÏÀÇ »çÁøÀ» ¾÷·ÎµåÇÏ¸é ÇØ´ç ½ºÅ¸ÀÏÀ» Âü°íÇÏ¿©
                  Æä¸£¼Ò³ª¸¦ »ý¼ºÇÕ´Ï´Ù.
                </p>

                {!personaReferenceImage ? (
                  <label className="block w-full cursor-pointer">
                    <div className="border-2 border-dashed border-blue-500 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-900/10 transition-all">
                      <div className="text-blue-300 text-4xl mb-3">??</div>
                      <p className="text-blue-200 font-medium mb-1">
                        ÂüÁ¶ ÀÌ¹ÌÁö ¾÷·Îµå
                      </p>
                      <p className="text-gray-400 text-sm">
                        Å¬¸¯ÇÏ¿© ÀÌ¹ÌÁö ¼±ÅÃ (JPG, PNG)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = (
                                event.target?.result as string
                              ).split(",")[1];
                              setPersonaReferenceImage(base64);
                            };
                            reader.readAsDataURL(file);
                          } catch (error) {
                            console.error("ÀÌ¹ÌÁö ·Îµå ½ÇÆÐ:", error);
                            setError("ÀÌ¹ÌÁö¸¦ ºÒ·¯¿À´Âµ¥ ½ÇÆÐÇß½À´Ï´Ù.");
                          }
                        }
                      }}
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img
                      src={`data:image/jpeg;base64,${personaReferenceImage}`}
                      alt="ÂüÁ¶ ÀÌ¹ÌÁö"
                      className="w-full max-h-64 object-contain rounded-lg border-2 border-blue-500"
                    />
                    <button
                      onClick={() => setPersonaReferenceImage(null)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                    >
                      ? »èÁ¦
                    </button>
                    <p className="text-green-400 text-sm mt-2 flex items-center">
                      <span className="mr-2">?</span>
                      ÂüÁ¶ ÀÌ¹ÌÁö°¡ ¾÷·ÎµåµÇ¾ú½À´Ï´Ù
                    </p>
                  </div>
                )}
              </div>

              {/* Ä¿½ºÅÒ ÇÁ·ÒÇÁÆ® (¼±ÅÃ»çÇ×) */}
              <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-blue-300 font-medium flex items-center">
                    <span className="mr-2">?</span>
                    Ä¿½ºÅÒ ÀÌ¹ÌÁö ÇÁ·ÒÇÁÆ® (¼±ÅÃ»çÇ×)
                  </h3>
                  <button
                    onClick={() => {
                      window.open("https://gemini.google.com/share/56de66e939ff", "_blank", "noopener,noreferrer");
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold rounded-lg text-sm transition-all duration-200 transform hover:scale-105 flex items-center"
                  >
                    <span className="mr-2">??</span>
                    ³»°¡ ¿øÇÏ´Â ÀÌ¹ÌÁö 200% »Ì´Â ³ëÇÏ¿ì
                  </button>
                </div>

                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="°í±Þ »ç¿ëÀÚ¿ë: AI¿¡°Ô Àü´ÞÇÒ ±¸Ã¼ÀûÀÎ ÀÌ¹ÌÁö ÇÁ·ÒÇÁÆ®¸¦ Á÷Á¢ ÀÔ·ÂÇÏ¼¼¿ä (¿µ¾î ±ÇÀå)"
                  className="w-full h-24 p-3 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-y"
                />
                <p className="text-gray-400 text-xs mt-2">
                  ?? ÀÌ ÇÊµå´Â °í±Þ »ç¿ëÀÚ¸¦ À§ÇÑ ±â´ÉÀÔ´Ï´Ù. ºñ¿öµÎ¸é ÀÚµ¿À¸·Î
                  ÃÖÀûÈ­µÈ ÇÁ·ÒÇÁÆ®°¡ »ý¼ºµË´Ï´Ù.
                </p>
              </div>

              {/* ÄÜÅÙÃ÷ Á¤Ã¥ À§¹Ý °æ°í */}
              {contentWarning && !isContentWarningAcknowledged && (
                <div className="mt-4 bg-orange-900/50 border border-orange-500 text-orange-300 p-4 rounded-lg">
                  <div className="flex items-start">
                    <span className="text-orange-400 text-xl mr-3">??</span>
                    <div className="flex-1">
                      <p className="font-medium mb-2">
                        ÄÜÅÙÃ÷ Á¤Ã¥ À§¹Ý °¡´É¼ºÀÌ ÀÖ´Â ´Ü¾î°¡ °¨ÁöµÇ¾ú½À´Ï´Ù
                      </p>
                      <div className="mb-3">
                        <p className="text-sm text-orange-200 mb-2">
                          °¨ÁöµÈ ´Ü¾î:
                        </p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {contentWarning.unsafeWords.map((word, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 bg-orange-800/50 rounded text-sm"
                            >
                              "{word}"
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleAutoReplace}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center"
                        >
                          ?? ¾ÈÀüÇÑ ´Ü¾î·Î ÀÚµ¿ ±³Ã¼
                        </button>
                        <button
                          onClick={handleAcknowledgeWarning}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          ¹«½ÃÇÏ°í °è¼Ó
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleGeneratePersonas}
                disabled={
                  isLoadingCharacters ||
                  !personaInput.trim() ||
                  !apiKey.trim() ||
                  (hasContentWarning && !isContentWarningAcknowledged)
                }
                className="mt-4 w-full sm:w-auto px-6 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
              >
                {isLoadingCharacters ? (
                  <>
                    <Spinner size="sm" />{" "}
                    <span className="ml-2">Æä¸£¼Ò³ª »ý¼º Áß...</span>
                  </>
                ) : (
                  "Æä¸£¼Ò³ª »ý¼º"
                )}
              </button>
            </section>

            {/* Æä¸£¼Ò³ª »ý¼º °ü·Ã ¿À·ù/¼º°ø ¸Þ½ÃÁö Ç¥½Ã */}
            {personaError && (
              <div
                className={
                  personaError.startsWith("?")
                    ? "bg-green-900/50 border border-green-500 text-green-300 p-4 rounded-lg"
                    : "bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg"
                }
              >
                <div className="flex items-start">
                  <span
                    className={
                      personaError.startsWith("?")
                        ? "text-green-400 text-xl mr-3"
                        : "text-red-400 text-xl mr-3"
                    }
                  >
                    {personaError.startsWith("?") ? "?" : "??"}
                  </span>
                  <div className="flex-1">
                    <pre className="font-medium mb-2 whitespace-pre-wrap text-sm leading-relaxed">{personaError}</pre>
                    <button
                      onClick={() => setPersonaError(null)}
                      className={
                        personaError.startsWith("?")
                          ? "mt-3 text-green-400 hover:text-green-300 text-sm underline"
                          : "mt-3 text-red-400 hover:text-red-300 text-sm underline"
                      }
                    >
                      ¿À·ù ¸Þ½ÃÁö ´Ý±â
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isLoadingCharacters && (
              <div className="text-center p-8">
                <Spinner size="lg" />
                <p className="mt-4 text-blue-300 text-lg font-semibold">
                  µîÀåÀÎ¹°À» ºÐ¼®ÇÏ°í ÀÌ¹ÌÁö¸¦ »ý¼ºÇÏ°í ÀÖ½À´Ï´Ù...
                </p>
                {loadingProgress && (
                  <div className="mt-4 bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-blue-300 font-bold text-lg animate-pulse">
                      ?? {loadingProgress}
                    </p>
                  </div>
                )}
                <p className="mt-4 text-gray-400 text-sm">
                  ? API °úºÎÇÏ ¹æÁö¸¦ À§ÇØ Ä³¸¯ÅÍ °£ 3-4ÃÊ ´ë±â ½Ã°£ÀÌ ÀÖ½À´Ï´Ù.
                </p>
                <p className="mt-2 text-gray-500 text-xs">
                  Àá½Ã¸¸ ±â´Ù·Á ÁÖ¼¼¿ä. °íÇ°Áú ÀÌ¹ÌÁö¸¦ »ý¼ºÇÏ´Â ÁßÀÔ´Ï´Ù.
                </p>
              </div>
            )}

            {characters.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-blue-300">
                    »ý¼ºµÈ Æä¸£¼Ò³ª ({characters.length}°³)
                  </h2>
                  <button
                    onClick={async () => {
                      try {
                        let successCount = 0;
                        let cancelCount = 0;
                        
                        for (let index = 0; index < characters.length; index++) {
                          const char = characters[index];
                          const safeCharName = char.name.replace(/[^a-zA-Z0-9¤¡-¤¾¤¿-¤Ó°¡-ÆR]/g, '_');
                          const fileName = `${index + 1}_${safeCharName}.jpg`;
                          
                          try {
                            const base64Response = await fetch(`data:image/jpeg;base64,${char.image}`);
                            const blob = await base64Response.blob();
                            
                            if ('showSaveFilePicker' in window) {
                              try {
                                const handle = await (window as any).showSaveFilePicker({
                                  suggestedName: fileName,
                                  types: [
                                    {
                                      description: 'ÀÌ¹ÌÁö ÆÄÀÏ',
                                      accept: {
                                        'image/jpeg': ['.jpg', '.jpeg'],
                                      },
                                    },
                                  ],
                                });
                                
                                const writable = await handle.createWritable();
                                await writable.write(blob);
                                await writable.close();
                                successCount++;
                              } catch (err: any) {
                                if (err.name === 'AbortError') {
                                  cancelCount++;
                                  console.log(`[${index + 1}/${characters.length}] »ç¿ëÀÚ°¡ ÀúÀåÀ» Ãë¼ÒÇß½À´Ï´Ù.`);
                                } else {
                                  throw err;
                                }
                              }
                            } else {
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              URL.revokeObjectURL(link.href);
                              successCount++;
                              await new Promise(resolve => setTimeout(resolve, 300));
                            }
                          } catch (err) {
                            console.error(`[°³¹ßÀÚ¿ë] Æä¸£¼Ò³ª ${index + 1} ´Ù¿î·Îµå ¿À·ù:`, err);
                            throw err;
                          }
                        }
                        
                        if (successCount > 0) {
                          setPersonaError(`? ${successCount}°³ÀÇ Æä¸£¼Ò³ª°¡ ÀúÀåµÇ¾ú½À´Ï´Ù!` + 
                                  (cancelCount > 0 ? ` (${cancelCount}°³ Ãë¼ÒµÊ)` : ''));
                        } else if (cancelCount > 0) {
                          setPersonaError(`¸ðµç ´Ù¿î·Îµå°¡ Ãë¼ÒµÇ¾ú½À´Ï´Ù.`);
                        }
                      } catch (error) {
                        console.error("[°³¹ßÀÚ¿ë] Æä¸£¼Ò³ª ´Ù¿î·Îµå ¿À·ù:", error);
                        
                        let userMessage = "Æä¸£¼Ò³ª ´Ù¿î·Îµå¿¡ ½ÇÆÐÇß½À´Ï´Ù. ´Ù½Ã ½ÃµµÇØ ÁÖ¼¼¿ä.";
                        
                        if (error instanceof Error) {
                          console.error(`[°³¹ßÀÚ¿ë] ¿À·ù »ó¼¼: ${error.name} - ${error.message}`);
                          
                          if (error.name === 'NotAllowedError') {
                            userMessage = "ÆÄÀÏ ÀúÀå ±ÇÇÑÀÌ °ÅºÎµÇ¾ú½À´Ï´Ù. ºê¶ó¿ìÀú ¼³Á¤À» È®ÀÎÇØ ÁÖ¼¼¿ä.";
                          } else if (error.name === 'SecurityError') {
                            userMessage = "º¸¾È ¹®Á¦·Î ÆÄÀÏÀ» ÀúÀåÇÒ ¼ö ¾ø½À´Ï´Ù. ºê¶ó¿ìÀú¸¦ ¾÷µ¥ÀÌÆ®ÇÏ°Å³ª ´Ù¸¥ ºê¶ó¿ìÀú¸¦ »ç¿ëÇØ ÁÖ¼¼¿ä.";
                          }
                        }
                        
                        setPersonaError(userMessage);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                  >
                    ?? ¸ðµÎ ´Ù¿î·Îµå ({characters.length}°³)
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {characters.map((char) => (
                    <CharacterCard
                      key={char.id}
                      character={char}
                      onRegenerate={handleRegenerateCharacter}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ±¤°í 2: Æä¸£¼Ò³ª »ý¼º°ú ¿µ»ó ¼Ò½º »ý¼º »çÀÌ */}
            <AdBanner />

            {/* 3´Ü°è´Â Ç×»ó Ç¥½Ã */}
            <section className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-green-500">
              <h2 className="text-2xl font-bold mb-4 text-green-400 flex items-center">
                <span className="mr-2">2??</span>
                ¿µ»ó ¼Ò½º »ý¼º
              </h2>
              <div className="mb-4">
                <p className="text-gray-400 text-sm mb-3">
                  {referenceImage
                    ? "ÂüÁ¶ ÀÌ¹ÌÁö¸¦ ±â¹ÝÀ¸·Î ¿µ»ó ¼Ò½º¸¦ »ý¼ºÇÕ´Ï´Ù. Æä¸£¼Ò³ª »ý¼º ¾øÀÌ ¹Ù·Î ÁøÇà °¡´ÉÇÕ´Ï´Ù."
                    : "À§¿¡¼­ »ý¼ºÇÑ Æä¸£¼Ò³ª¸¦ È°¿ëÇÏ¿© ¿µ»ó ¼Ò½º¸¦ ¸¸µì´Ï´Ù."}{" "}
                  ´ëº» ¶Ç´Â ½ÃÄö½ºº° Àå¸éÀ» ÀÔ·ÂÇØÁÖ¼¼¿ä.
                </p>
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 mb-4">
                  <p className="text-green-200 text-sm mb-2">
                    <strong>ÀÔ·Â ¹æ¹ý:</strong>
                  </p>
                  <ul className="text-green-300 text-sm space-y-1 ml-4">
                    <li>
                      ? <strong>ÀüÃ¼ ´ëº»:</strong> ¿ÏÀüÇÑ ½ºÅ©¸³Æ®³ª ½ºÅä¸®¸¦
                      ÀÔ·Â
                    </li>
                    <li>
                      ? <strong>½ÃÄö½ºº° Àå¸é:</strong> °¢ ÁÙ¿¡ ÇÏ³ª¾¿ Àå¸é
                      ¼³¸íÀ» ÀÔ·Â
                    </li>
                  </ul>
                </div>
              </div>

              {/* ÀÏ°ü¼º À¯Áö (¼±ÅÃ»çÇ×) - ¿µ»ó ¼Ò½º »ý¼ºÀ¸·Î ÀÌµ¿ */}
              <div className="mb-6 bg-green-900/20 border border-green-500/50 rounded-lg p-6">
                <h3 className="text-green-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">??</span>
                  ÀÏ°ü¼º À¯Áö (¼±ÅÃ»çÇ×)
                </h3>
                <p className="text-green-200 text-sm mb-3">
                  ÂüÁ¶ ÀÌ¹ÌÁö¸¦ ¾÷·ÎµåÇÏ¸é ÇØ´ç ÀÌ¹ÌÁöÀÇ ½ºÅ¸ÀÏ°ú ÀÏ°ü¼ºÀ»
                  À¯ÁöÇÏ¸ç ¿µ»ó ¼Ò½º¸¦ »ý¼ºÇÕ´Ï´Ù.
                  {!referenceImage &&
                    " ÂüÁ¶ ÀÌ¹ÌÁö°¡ ÀÖÀ¸¸é Æä¸£¼Ò³ª »ý¼º ¾øÀÌµµ ¹Ù·Î ¿µ»ó ¼Ò½º¸¦ ¸¸µé ¼ö ÀÖ½À´Ï´Ù!"}
                </p>

                {!referenceImage ? (
                  <div className="border-2 border-dashed border-green-400 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageUpload}
                      className="hidden"
                      id="referenceImageInput"
                    />
                    <label
                      htmlFor="referenceImageInput"
                      className="cursor-pointer flex flex-col items-center space-y-2 hover:text-green-300 transition-colors"
                    >
                      <div className="text-3xl">??</div>
                      <div className="text-green-300 font-medium">
                        ÂüÁ¶ ÀÌ¹ÌÁö ¾÷·Îµå
                      </div>
                      <div className="text-green-400 text-sm">
                        Å¬¸¯ÇÏ¿© ÀÌ¹ÌÁö¸¦ ¼±ÅÃÇÏ¼¼¿ä
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="relative bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <img
                        src={`data:image/jpeg;base64,${referenceImage}`}
                        alt="ÂüÁ¶ ÀÌ¹ÌÁö"
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <div className="text-green-300 font-medium">
                          ÂüÁ¶ ÀÌ¹ÌÁö ¾÷·ÎµåµÊ
                        </div>
                        <div className="text-green-400 text-sm">
                          ÀÌ ÀÌ¹ÌÁöÀÇ ½ºÅ¸ÀÏÀ» Âü°íÇÏ¿© ¿µ»ó ¼Ò½º¸¦ »ý¼ºÇÕ´Ï´Ù
                        </div>
                      </div>
                      <button
                        onClick={handleRemoveReferenceImage}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                      >
                        »èÁ¦
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <textarea
                value={videoSourceScript}
                onChange={(e) => setVideoSourceScript(e.target.value)}
                placeholder="´ëº» ÀüÃ¼¸¦ ³ÖÀ¸¼¼¿ä. ¶Ç´Â ½ÃÄö½ºº° ¿øÇÏ´Â Àå¸éÀ» ³ÖÀ¸¼¼¿ä.

¿¹½Ã:
1. ¹Ì·¡ µµ½Ã ¿Á»ó¿¡¼­ ·Îº¿ÀÌ »õº®À» ¹Ù¶óº¸¸ç ¼­ ÀÖ´Â Àå¸é
2. °øÁßÁ¤¿ø¿¡¼­ È¦·Î±×·¥ ³ªºñµéÀÌ ÃãÃß´Â ¸ð½À  
3. ³×¿Â»çÀÎÀÌ ¹Ý»çµÈ ºø¼Ó °Å¸®¸¦ °É¾î°¡´Â »çÀÌº¸±×
4. ¿ìÁÖ Á¤°ÅÀå Ã¢¹® ³Ê¸Ó·Î Áö±¸¸¦ ³»·Á´Ùº¸´Â Àå¸é"
                className="w-full h-48 p-4 bg-gray-900 border-2 border-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors duration-200 resize-y mb-4"
              />

              {/* »ý¼º ¿É¼Ç ¼³Á¤ */}
              <div className="mb-4 bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                <h3 className="text-green-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">??</span>
                  »ý¼º ¿É¼Ç ¼³Á¤
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* ÀÚ¸· ¼³Á¤ */}
                  <div>
                    <label className="block text-sm font-medium text-green-200 mb-2">
                      ?? ÀÚ¸· ¼³Á¤
                    </label>
                    <select
                      value={subtitleEnabled ? "on" : "off"}
                      onChange={(e) =>
                        setSubtitleEnabled(e.target.value === "on")
                      }
                      className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-green-200 focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="off">?? ÀÚ¸· OFF (±âº»°ª)</option>
                      <option value="on">?? ÀÚ¸· ON</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      ÀÚ¸· Æ÷ÇÔ ¿©ºÎ¸¦ ¼±ÅÃÇÏ¼¼¿ä
                    </p>
                  </div>

                  {/* ÀÌ¹ÌÁö ¼ö ¼³Á¤ */}
                  <div>
                    <Slider
                      label="»ý¼ºÇÒ ÀÌ¹ÌÁö ¼ö"
                      min={5}
                      max={20}
                      value={Math.min(imageCount, 20)}
                      onChange={(e) => setImageCount(parseInt(e.target.value))}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      ¾ÈÁ¤ÀûÀÎ »ý¼ºÀ» À§ÇØ ÃÖ´ë 20°³·Î Á¦ÇÑ
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={handleGenerateVideoSource}
                  disabled={
                    isLoadingVideoSource ||
                    !videoSourceScript.trim() ||
                    !apiKey.trim() ||
                    (characters.length === 0 && !referenceImage) ||
                    (hasContentWarning && !isContentWarningAcknowledged)
                  }
                  className="w-full sm:w-auto px-6 py-3 bg-green-600 font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                >
                  {isLoadingVideoSource ? (
                    <>
                      <Spinner size="sm" />{" "}
                      <span className="ml-2">¿µ»ó ¼Ò½º »ý¼º Áß...</span>
                    </>
                  ) : (
                    "¿µ»ó ¼Ò½º »ý¼º"
                  )}
                </button>
                {characters.length === 0 && !referenceImage && (
                  <p className="text-yellow-400 text-sm mt-2">
                    ?? ¿µ»ó ¼Ò½º¸¦ »ý¼ºÇÏ·Á¸é À§¿¡¼­ Æä¸£¼Ò³ª¸¦ ¸ÕÀú »ý¼ºÇÏ°Å³ª, ÂüÁ¶ ÀÌ¹ÌÁö¸¦ ¾÷·ÎµåÇØÁÖ¼¼¿ä.
                  </p>
                )}
              </div>
            </section>

            {/* ¿µ»ó ¼Ò½º »ý¼º °ü·Ã ¿À·ù Ç¥½Ã */}
            {error && (
              <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg">
                <div className="flex items-start">
                  <span className="text-red-400 text-xl mr-3">
                    {error.startsWith("??") ? "??" : "?"}
                  </span>
                  <div className="flex-1">
                    <pre className="font-medium mb-2 whitespace-pre-wrap text-sm leading-relaxed">{error}</pre>
                  </div>
                </div>
              </div>
            )}

            {isLoadingVideoSource && (
              <div className="text-center p-8">
                <Spinner size="lg" />
                <p className="mt-4 text-green-300 text-lg font-semibold">
                  Àå¸éÀ» ¸¸µé°í ÀÖ½À´Ï´Ù...
                </p>
                {loadingProgress && (
                  <div className="mt-4 bg-green-900/30 border border-green-500/50 rounded-lg p-4 max-w-md mx-auto">
                    <p className="text-green-300 font-bold text-lg animate-pulse">
                      ?? {loadingProgress}
                    </p>
                  </div>
                )}
                <p className="mt-4 text-gray-400 text-sm">
                  ? API °úºÎÇÏ ¹æÁö¸¦ À§ÇØ ÀÌ¹ÌÁö °£ 3-4ÃÊ ´ë±â ½Ã°£ÀÌ ÀÖ½À´Ï´Ù.
                </p>
                <p className="mt-2 text-gray-500 text-xs">
                  ÀÌ ÀÛ¾÷Àº ½Ã°£ÀÌ °É¸± ¼ö ÀÖ½À´Ï´Ù. Àá½Ã¸¸ ±â´Ù·Á ÁÖ¼¼¿ä.
                </p>
              </div>
            )}

            {videoSource.length > 0 && (
              <section>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
                  <h2 className="text-2xl font-bold text-blue-300">
                    »ý¼ºµÈ ¿µ»ó ¼Ò½º
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateVideoSource}
                      disabled={
                        isLoadingVideoSource ||
                        !videoSourceScript.trim() ||
                        !apiKey.trim() ||
                        (hasContentWarning && !isContentWarningAcknowledged)
                      }
                      className="px-4 py-2 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                    >
                      {isLoadingVideoSource ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ml-2">»ý¼º Áß...</span>
                        </>
                      ) : (
                        "ÇÑ ¹ø ´õ »ý¼º"
                      )}
                    </button>
                    <button
                      onClick={handleDownloadAllImages}
                      disabled={isDownloading}
                      className="px-4 py-2 bg-green-600 font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                    >
                      {isDownloading ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ml-2">¾ÐÃà Áß...</span>
                        </>
                      ) : (
                        "¸ðµç ÀÌ¹ÌÁö ÀúÀå"
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videoSource.map((item) => (
                    <StoryboardImage
                      key={item.id}
                      item={item}
                      onRegenerate={handleRegenerateVideoSourceImage}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ±¤°í 3: ¿µ»ó ¼Ò½º »ý¼º°ú Ä«¸Þ¶ó ¾Þ±Û »ý¼º »çÀÌ */}
            <AdBanner />

            {/* 4´Ü°è: Ä«¸Þ¶ó ¾Þ±Û È®Àå */}
            <section className="bg-gray-800 p-6 rounded-xl shadow-2xl border-2 border-orange-500">
              <h2 className="text-2xl font-bold mb-4 text-orange-400 flex items-center">
                <span className="mr-2">3??</span>
                »çÁø ±¸µµ È®Àå (ÃÖ´ë 6°¡Áö ¾Þ±Û)
              </h2>
              <p className="text-orange-200 text-sm mb-4">
                ¿øÇÏ´Â ¾Þ±ÛÀ» ¼±ÅÃÇÏ¿© ´Ù¾çÇÑ ±¸µµÀÇ ÀÌ¹ÌÁö¸¦ »ý¼ºÇÕ´Ï´Ù.
              </p>

              {/* Áß¿ä ¾È³» */}
              <div className="mb-4 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                <p className="text-blue-300 text-sm font-semibold mb-2">
                  ?? ÀÛµ¿ ¹æ½Ä
                </p>
                <ul className="text-blue-200 text-xs space-y-1 list-disc list-inside">
                  <li><strong>1´Ü°è:</strong> Gemini Vision AI°¡ ¾÷·ÎµåÇÑ ÀÌ¹ÌÁö¸¦ »ó¼¼È÷ ºÐ¼® (ÇÇ»çÃ¼, Á¶¸í, ½ºÅ¸ÀÏ µî)</li>
                  <li><strong>2´Ü°è:</strong> ºÐ¼® °á°ú¸¦ ¹ÙÅÁÀ¸·Î ¼±ÅÃÇÑ ¾Þ±Ûº°·Î ÀÌ¹ÌÁö Àç»ý¼º</li>
                  <li><strong>¸ñÇ¥:</strong> µ¿ÀÏÇÑ ÇÇ»çÃ¼¸¦ ´Ù¾çÇÑ Ä«¸Þ¶ó °¢µµ¿¡¼­ Ç¥Çö</li>
                  <li><strong>À¯ÀÇ»çÇ×:</strong> AI Àç»ý¼ºÀÌ¹Ç·Î 100% µ¿ÀÏÇÏÁö ¾ÊÀ» ¼ö ÀÖÀ½</li>
                  <li><strong>Ã³¸® ½Ã°£:</strong> API Á¦ÇÑÀ¸·Î ¾Þ±Û´ç 5-6ÃÊ ¼Ò¿ä (6°³ ¼±ÅÃ ½Ã ¾à 30-40ÃÊ)</li>
                </ul>
              </div>

              {/* ÀÌ¹ÌÁö ¾÷·Îµå ¼½¼Ç */}
              <div className="mb-6 bg-orange-900/20 border border-orange-500/50 rounded-lg p-6">
                <h3 className="text-orange-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">??</span>
                  ºÐ¼®ÇÒ ¿øº» ÀÌ¹ÌÁö ¾÷·Îµå
                </h3>
                <p className="text-orange-200 text-sm mb-3">
                  ÀÌ¹ÌÁö¸¦ ¾÷·ÎµåÇÏ¸é AI°¡ »ó¼¼È÷ ºÐ¼®ÇÑ ÈÄ, ¼±ÅÃÇÑ Ä«¸Þ¶ó ¾Þ±Û·Î Àç»ý¼ºÇÕ´Ï´Ù.
                </p>

                {!cameraAngleSourceImage ? (
                  <div className="border-2 border-dashed border-orange-400 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleCameraAngleImageUpload}
                      className="hidden"
                      id="cameraAngleImageInput"
                    />
                    <label
                      htmlFor="cameraAngleImageInput"
                      className="cursor-pointer flex flex-col items-center space-y-2 hover:text-orange-300 transition-colors"
                    >
                      <div className="text-3xl">??</div>
                      <div className="text-orange-300 font-medium">
                        ¿øº» ÀÌ¹ÌÁö ¾÷·Îµå
                      </div>
                      <div className="text-orange-400 text-sm">
                        Å¬¸¯ÇÏ¿© ÀÌ¹ÌÁö¸¦ ¼±ÅÃÇÏ¼¼¿ä
                      </div>
                      <div className="text-orange-300 text-xs mt-2">
                        JPG, PNG, WEBP Çü½Ä Áö¿ø (ÃÖ´ë 10MB)
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="relative bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <img
                        src={cameraAngleSourceImage}
                        alt="Ä«¸Þ¶ó ¾Þ±Û ¿øº» ÀÌ¹ÌÁö"
                        className="w-20 h-20 object-cover rounded-lg border-2 border-orange-400"
                      />
                      <div className="flex-1">
                        <p className="text-orange-300 font-medium">¿øº» ÀÌ¹ÌÁö ¾÷·Îµå ¿Ï·á</p>
                        <p className="text-orange-400 text-sm">10°¡Áö ¾Þ±Û·Î º¯È¯ÇÒ ÁØºñ°¡ µÇ¾ú½À´Ï´Ù</p>
                      </div>
                      <button
                        onClick={() => {
                          setCameraAngleSourceImage(null);
                          setCameraAngles([]);
                          setCameraAngleError(null);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-semibold"
                      >
                        »èÁ¦
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ¾Þ±Û ¼±ÅÃ ¼½¼Ç */}
              <div className="mb-6 bg-orange-900/20 border border-orange-500/50 rounded-lg p-6">
                <h3 className="text-orange-300 font-medium mb-3 flex items-center">
                  <span className="mr-2">?</span>
                  »ý¼ºÇÒ ¾Þ±Û ¼±ÅÃ ({selectedCameraAngles.length}/6)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'Front View' as CameraAngle, label: 'Á¤¸é', emoji: '??', direction: '' },
                    { value: 'Right Side View' as CameraAngle, label: '¿À¸¥ÂÊ Ãø¸é', emoji: '??', direction: '(¿ÞÂÊÀ» ¹Ù¶óº½)' },
                    { value: 'Left Side View' as CameraAngle, label: '¿ÞÂÊ Ãø¸é', emoji: '??', direction: '(¿À¸¥ÂÊÀ» ¹Ù¶óº½)' },
                    { value: 'Back View' as CameraAngle, label: 'µÞ¸ð½À', emoji: '??', direction: '' },
                    { value: 'Full Body' as CameraAngle, label: 'Àü½Å', emoji: '??', direction: '' },
                    { value: 'Close-up Face' as CameraAngle, label: '¾ó±¼ ±ÙÁ¢', emoji: '??', direction: '' },
                  ].map((angle) => (
                    <label
                      key={angle.value}
                      className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${
                        selectedCameraAngles.includes(angle.value)
                          ? 'bg-orange-600/40 border-2 border-orange-400'
                          : 'bg-gray-700/50 border-2 border-gray-600 hover:bg-gray-600/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCameraAngles.includes(angle.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCameraAngles([...selectedCameraAngles, angle.value]);
                          } else {
                            setSelectedCameraAngles(selectedCameraAngles.filter(a => a !== angle.value));
                          }
                        }}
                        className="w-5 h-5 mr-3"
                      />
                      <span className="text-xl mr-2">{angle.emoji}</span>
                      <div className="flex flex-col">
                        <span className="text-orange-200 font-medium text-sm">{angle.label}</span>
                        {angle.direction && (
                          <span className="text-orange-300/60 text-xs">{angle.direction}</span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => setSelectedCameraAngles([
                      'Front View', 'Right Side View', 'Left Side View', 'Back View', 'Full Body', 'Close-up Face'
                    ])}
                    className="px-3 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700"
                  >
                    ÀüÃ¼ ¼±ÅÃ
                  </button>
                  <button
                    onClick={() => setSelectedCameraAngles([])}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                  >
                    ÀüÃ¼ ÇØÁ¦
                  </button>
                </div>
              </div>

              {/* ºñÀ² ¼±ÅÃ */}
              <div className="mb-4">
                <label className="block text-orange-300 text-sm mb-2 font-semibold">
                  ?? »ý¼ºÇÒ ÀÌ¹ÌÁö ºñÀ²
                </label>
                <AspectRatioSelector
                  selectedRatio={aspectRatio}
                  onRatioChange={setAspectRatio}
                />
              </div>

              {/* »ý¼º ¹öÆ° - ·Îµù ÁßÀÌ ¾Æ´Ò ¶§¸¸ Ç¥½Ã */}
              {!isLoadingCameraAngles && (
                <>
                  <button
                    onClick={handleGenerateCameraAngles}
                    disabled={!cameraAngleSourceImage || !apiKey || selectedCameraAngles.length === 0}
                    className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                      !cameraAngleSourceImage || !apiKey || selectedCameraAngles.length === 0
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl transform hover:scale-105"
                    }`}
                  >
                    ?? ¼±ÅÃÇÑ {selectedCameraAngles.length}°¡Áö ¾Þ±Û »ý¼ºÇÏ±â
                  </button>

                  {!apiKey && (
                    <p className="text-yellow-400 text-sm mt-2">
                      ?? ¼­¹ö API Å°°¡ ¼³Á¤µÇÁö ¾Ê¾Ò½À´Ï´Ù. °ü¸®ÀÚ¿¡°Ô ¹®ÀÇÇØÁÖ¼¼¿ä.
                    </p>
                  )}
                </>
              )}

              {/* ·Îµù Áß ÁøÇà »óÈ² Ç¥½Ã - ÁÖÈ²»ö ¹Ú½º¸¸ Ç¥½Ã */}
              {isLoadingCameraAngles && cameraAngleProgress && (
                <div className="mt-6">
                  <div className="bg-gradient-to-br from-orange-900/40 to-orange-800/30 border-2 border-orange-500 rounded-xl p-8 shadow-2xl">
                    <div className="flex flex-col items-center space-y-4">
                      <Spinner size="lg" />
                      <div className="text-center">
                        <p className="text-orange-300 font-bold text-2xl animate-pulse">
                          ?? {cameraAngleProgress}
                        </p>
                        <p className="mt-3 text-orange-400 text-base">
                          ? ¾Þ±Û °£ 5-6ÃÊ ´ë±â (API ÇÒ´ç·® º¸È£)
                        </p>
                        <p className="mt-2 text-orange-500 text-sm">
                          ¼±ÅÃÇÑ {selectedCameraAngles.length}°¡Áö ¾Þ±Û »ý¼º¿¡´Â ¾à {Math.ceil(selectedCameraAngles.length * 6 / 60)}ºÐ ¼Ò¿ä
                        </p>
                        <div className="mt-4 bg-orange-950/50 rounded-lg p-3">
                          <p className="text-orange-300 text-xs">
                            ?? »ý¼º Áß¿¡´Â ºê¶ó¿ìÀú¸¦ ´ÝÁö ¸¶¼¼¿ä
                          </p>
                          <p className="text-orange-400 text-xs mt-1">
                            ?? ÇÒ´ç·® ÃÊ°ú ½Ã »ý¼ºµÈ ÀÌ¹ÌÁö¸¸ ÀúÀåµË´Ï´Ù
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ¿¡·¯ ¸Þ½ÃÁö */}
              {cameraAngleError && !isLoadingCameraAngles && (
                <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded-lg">
                  <pre className="text-red-400 text-sm whitespace-pre-wrap font-mono">
                    {cameraAngleError}
                  </pre>
                </div>
              )}

              {/* »ý¼ºµÈ Ä«¸Þ¶ó ¾Þ±Û °á°ú ±×¸®µå */}
              {cameraAngles.length > 0 && !isLoadingCameraAngles && (
                <div className="mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-orange-300">
                      ?? »ý¼ºµÈ Ä«¸Þ¶ó ¾Þ±Û ({cameraAngles.length}°³)
                    </h3>
                    <button
                      onClick={async () => {
                        try {
                          let successCount = 0;
                          let cancelCount = 0;
                          
                          for (let index = 0; index < cameraAngles.length; index++) {
                            const angleImg = cameraAngles[index];
                            const fileName = `${index + 1}_${angleImg.angleName}.png`;
                            
                            try {
                              const base64Data = angleImg.image.includes(',') 
                                ? angleImg.image.split(',')[1] 
                                : angleImg.image;
                              const base64Response = await fetch(`data:image/png;base64,${base64Data}`);
                              const blob = await base64Response.blob();
                              
                              if ('showSaveFilePicker' in window) {
                                try {
                                  const handle = await (window as any).showSaveFilePicker({
                                    suggestedName: fileName,
                                    types: [
                                      {
                                        description: 'ÀÌ¹ÌÁö ÆÄÀÏ',
                                        accept: {
                                          'image/png': ['.png'],
                                        },
                                      },
                                    ],
                                  });
                                  
                                  const writable = await handle.createWritable();
                                  await writable.write(blob);
                                  await writable.close();
                                  successCount++;
                                } catch (err: any) {
                                  if (err.name === 'AbortError') {
                                    cancelCount++;
                                    console.log(`[${index + 1}/${cameraAngles.length}] »ç¿ëÀÚ°¡ ÀúÀåÀ» Ãë¼ÒÇß½À´Ï´Ù.`);
                                  } else {
                                    throw err;
                                  }
                                }
                              } else {
                                const link = document.createElement('a');
                                link.href = URL.createObjectURL(blob);
                                link.download = fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(link.href);
                                successCount++;
                                await new Promise(resolve => setTimeout(resolve, 300));
                              }
                            } catch (err) {
                              console.error(`[°³¹ßÀÚ¿ë] Ä«¸Þ¶ó ¾Þ±Û ${index + 1} ´Ù¿î·Îµå ¿À·ù:`, err);
                              throw err;
                            }
                          }
                          
                          if (successCount > 0) {
                            setCameraAngleError(`? ${successCount}°³ÀÇ Ä«¸Þ¶ó ¾Þ±ÛÀÌ ÀúÀåµÇ¾ú½À´Ï´Ù!` + 
                                    (cancelCount > 0 ? ` (${cancelCount}°³ Ãë¼ÒµÊ)` : ''));
                          } else if (cancelCount > 0) {
                            setCameraAngleError(`¸ðµç ´Ù¿î·Îµå°¡ Ãë¼ÒµÇ¾ú½À´Ï´Ù.`);
                          }
                        } catch (error) {
                          console.error("[°³¹ßÀÚ¿ë] Ä«¸Þ¶ó ¾Þ±Û ´Ù¿î·Îµå ¿À·ù:", error);
                          
                          let userMessage = "Ä«¸Þ¶ó ¾Þ±Û ´Ù¿î·Îµå¿¡ ½ÇÆÐÇß½À´Ï´Ù. ´Ù½Ã ½ÃµµÇØ ÁÖ¼¼¿ä.";
                          
                          if (error instanceof Error) {
                            console.error(`[°³¹ßÀÚ¿ë] ¿À·ù »ó¼¼: ${error.name} - ${error.message}`);
                            
                            if (error.name === 'NotAllowedError') {
                              userMessage = "ÆÄÀÏ ÀúÀå ±ÇÇÑÀÌ °ÅºÎµÇ¾ú½À´Ï´Ù. ºê¶ó¿ìÀú ¼³Á¤À» È®ÀÎÇØ ÁÖ¼¼¿ä.";
                            } else if (error.name === 'SecurityError') {
                              userMessage = "º¸¾È ¹®Á¦·Î ÆÄÀÏÀ» ÀúÀåÇÒ ¼ö ¾ø½À´Ï´Ù. ºê¶ó¿ìÀú¸¦ ¾÷µ¥ÀÌÆ®ÇÏ°Å³ª ´Ù¸¥ ºê¶ó¿ìÀú¸¦ »ç¿ëÇØ ÁÖ¼¼¿ä.";
                            }
                          }
                          
                          setCameraAngleError(userMessage);
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                    >
                      ?? ÀüÃ¼ ´Ù¿î·Îµå ({cameraAngles.length}°³)
                    </button>
                  </div>

                  {/* 4¿­ x 5Çà ±×¸®µå */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {cameraAngles.map((angleImg) => (
                      <div
                        key={angleImg.id}
                        className="bg-gray-700 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all transform hover:scale-105"
                      >
                        <div className="relative aspect-square">
                          <img
                            src={angleImg.image}
                            alt={angleImg.angleName}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => {
                              // »õÃ¢À¸·Î ÀÌ¹ÌÁö ¿­±â
                              openImageInNewWindow(angleImg.image, `Ä«¸Þ¶ó ¾Þ±Û - ${angleImg.angleName}`);
                            }}
                          />
                        </div>
                        <div className="p-3">
                          <h4 className="font-bold text-white text-sm mb-1">
                            {angleImg.angleName}
                          </h4>
                          <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                            {angleImg.description}
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                // Base64¸¦ BlobÀ¸·Î º¯È¯
                                const response = await fetch(angleImg.image);
                                const blob = await response.blob();
                                
                                // File System Access API Áö¿ø È®ÀÎ
                                if ('showSaveFilePicker' in window) {
                                  try {
                                    const handle = await (window as any).showSaveFilePicker({
                                      suggestedName: `Ä«¸Þ¶ó-¾Þ±Û-${angleImg.angleName}.jpg`,
                                      types: [
                                        {
                                          description: 'ÀÌ¹ÌÁö ÆÄÀÏ',
                                          accept: {
                                            'image/jpeg': ['.jpg', '.jpeg'],
                                          },
                                        },
                                      ],
                                    });
                                    
                                    const writable = await handle.createWritable();
                                    await writable.write(blob);
                                    await writable.close();
                                  } catch (err: any) {
                                    if (err.name !== 'AbortError') {
                                      throw err;
                                    }
                                  }
                                } else {
                                  // Æú¹é: ±âÁ¸ ´Ù¿î·Îµå ¹æ½Ä
                                  const link = document.createElement('a');
                                  link.href = URL.createObjectURL(blob);
                                  link.download = `Ä«¸Þ¶ó-¾Þ±Û-${angleImg.angleName}.jpg`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  URL.revokeObjectURL(link.href);
                                }
                              } catch (error) {
                                console.error("[°³¹ßÀÚ¿ë] ÀÌ¹ÌÁö ´Ù¿î·Îµå ¿À·ù:", error);
                              }
                            }}
                            className="w-full py-2 bg-orange-600 text-white rounded text-xs font-semibold hover:bg-orange-700 transition-colors"
                          >
                            ?? ´Ù¿î·Îµå
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* ¿µ»ó Á¦ÀÛ µµ±¸ ¹è³Ê */}
            <section className="my-8">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-xl font-bold mb-2">
                  ?? ´õ ¸¹Àº ¿µ»ó Á¦ÀÛ µµ±¸°¡ ÇÊ¿äÇÏ½Å°¡¿ä?
                </h3>
                <p className="mb-4">
                  ÇÁ·ÎÆä¼Å³ÎÇÑ ¿µ»ó ÆíÁý°ú È¿°ú¸¦ À§ÇÑ µµ±¸µéÀ» È®ÀÎÇØº¸¼¼¿ä!
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <a
                    href="https://youtube.money-hotissue.com"
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all shadow-md hover:shadow-xl cursor-pointer"
                  >
                    ?? ¶±»óÇÑ ´ëº» 1ºÐ Ä«ÇÇ
                  </a>
                  <a
                    href="https://aimusic.money-hotissue.com/"
                    className="px-6 py-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-lg font-semibold hover:from-sky-600 hover:to-sky-700 transform hover:scale-105 transition-all shadow-md hover:shadow-xl cursor-pointer"
                  >
                    ?? AI À½¾Ç °¡»ç 1ÃÊ ¿Ï¼º
                  </a>
                  <a
                    href="https://aimusic.money-hotissue.com/"
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-indigo-700 transform hover:scale-105 transition-all shadow-md hover:shadow-xl cursor-pointer"
                  >
                    ?? AI À½¾Ç ½æ³×ÀÏ Á¦ÀÛ
                  </a>
                </div>
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="mt-16 py-8 border-t border-gray-700">
            <div className="max-w-4xl mx-auto px-4">
              <div className="text-center space-y-4">
                {/* ÀúÀÛ±Ç Ç¥½Ã */}
                <p className="text-gray-500 text-sm">
                  ¨Ï {new Date().getFullYear()} À¯Æ©ºê ·ÕÆû ÀÌ¹ÌÁö »ý¼º±â. ¸ðµç ±Ç¸® º¸À¯.
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
      <FloatingBottomAd />

      {/* ÃÊ±âÈ­ ¹öÆ° - ¿À¸¥ÂÊ ÇÏ´Ü °íÁ¤ */}
      <button
        onClick={handleResetAll}
        className="fixed bottom-24 right-6 z-[10000] px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 flex items-center gap-2 border-2 border-red-500"
        title="¸ðµç ÀÛ¾÷ µ¥ÀÌÅÍ ÃÊ±âÈ­"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clipRule="evenodd"
          />
        </svg>
        ÃÊ±âÈ­
      </button>
    </>
  );
};

export default App;




