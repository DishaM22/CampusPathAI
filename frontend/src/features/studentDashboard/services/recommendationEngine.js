// ============================================================
// CampusPath AI
// Recommendation / Event Data Layer
// ============================================================
// Hybrid Recommendation Engine
//
// Existing methods retained:
//   - Student feature engineering
//   - Skill matching
//   - Interest matching
//   - Career matching
//   - Category/domain matching
//   - Weighted content scoring
//   - Score-based ranking
//
// Added methodology support:
//   - Semantic similarity
//   - Sentence-embedding score from backend
//   - Semantic event embeddings from backend
//   - Vector retrieval score from backend
//   - Implicit feedback
//   - MLP ranker score
//   - Timetable-aware scoring
//   - Availability-aware scoring
//   - Context-aware re-ranking
//   - Diversity-aware re-ranking
//   - Backend ranking
//
// IMPORTANT:
// This frontend/data layer does NOT train sentence-transformers
// or an MLP. Those models should run in the Python backend.
// This file consumes their scores and safely falls back to the
// original content-based algorithm when those scores are absent.
// ============================================================



// ============================================================
// CATEGORY EMOJI
// ============================================================

const CATEGORY_EMOJI = {
  "Technical Workshops": "🛠️",
  Hackathons: "💻",
  Career: "💼",
  Cultural: "🎭",
  Sports: "🏅",
  Academic: "📚",
  Competitions: "🏆",
  Seminars: "🎤",
  Other: "✨",
};



// ============================================================
// CATEGORY HUE
// ============================================================

const CATEGORY_HUE = {
  "Technical Workshops": 260,
  Hackathons: 285,
  Career: 205,
  Cultural: 330,
  Sports: 150,
  Academic: 190,
  Competitions: 245,
  Seminars: 215,
  Other: 230,
};



// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s+#.-]/g, " ");
}



// ============================================================
// CONVERT VALUE TO ARRAY
// ============================================================

function toArray(value) {
  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map(normalizeText)
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
}



// ============================================================
// SAFE NUMBER
// ============================================================

function safeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}



// ============================================================
// CLAMP SCORE
// ============================================================

function clampScore(value) {
  return Math.round(
    Math.min(
      100,
      Math.max(
        0,
        safeNumber(value, 0)
      )
    )
  );
}



// ============================================================
// TIME PARSER
// ============================================================

function parseTime(value) {
  if (!value) {
    return {
      start: 9,
      end: 10,
    };
  }

  const parts = String(value).split(
    /\s*(?:–|-|to)\s*/i
  );

  const parseOne = (text) => {
    const match = String(text)
      .trim()
      .match(
        /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i
      );

    if (!match) {
      return 9;
    }

    let hour = Number(match[1]);

    const minute = Number(
      match[2] || 0
    );

    const period = (
      match[3] || ""
    ).toUpperCase();

    if (
      period === "PM" &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (
      period === "AM" &&
      hour === 12
    ) {
      hour = 0;
    }

    return hour + minute / 60;
  };

  const start = parseOne(parts[0]);

  const end = parts[1]
    ? parseOne(parts[1])
    : start + 1;

  return {
    start,
    end,
  };
}



// ============================================================
// GET STUDENT PROFILE FEATURES
// ============================================================

function getStudentFeatures(student = {}) {
  return {
    skills: toArray(
      student.skills ||
      student.skill ||
      student.technical_skills
    ),

    interests: toArray(
      student.interests ||
      student.interest
    ),

    goals: toArray(
      student.goals ||
      student.goal
    ),

    domains: toArray(
      student.domains ||
      student.preferred_domains ||
      student.preferredDomains
    ),

    preferredDomains: toArray(
      student.preferred_domains ||
      student.preferredDomains ||
      student.domains
    ),

    careerGoal: normalizeText(
      student.career_goal ||
      student.careerGoal ||
      student.career ||
      ""
    ),

    department: normalizeText(
      student.department ||
      student.dept ||
      student.branch ||
      ""
    ),

    year: normalizeText(
      student.year ||
      student.yr ||
      ""
    ),
  };
}



// ============================================================
// STUDENT SEMANTIC TEXT
// ============================================================
// This representation is used by the backend sentence-transformer
// model to create a student embedding.
//
// If backend semantic_score is returned, this frontend does not
// need to generate the embedding itself.

export function getStudentSemanticText(student = {}) {
  const features = getStudentFeatures(student);

  return normalizeText(
    [
      features.skills.join(" "),
      features.interests.join(" "),
      features.domains.join(" "),
      features.preferredDomains.join(" "),
      features.careerGoal,
      features.department,
      features.year,
    ].join(" ")
  );
}



// ============================================================
// EVENT TEXT
// ============================================================

function getEventText(event) {
  return normalizeText(
    [
      event.title,
      event.description,
      event.category,
      event.organizer,
      event.location,
      ...(Array.isArray(event.skills)
        ? event.skills
        : []),
    ].join(" ")
  );
}



// ============================================================
// EVENT SEMANTIC TEXT
// ============================================================
// Used by the backend for sentence embeddings.

export function getEventSemanticText(event = {}) {
  return getEventText(event);
}



// ============================================================
// CHECK FEATURE MATCH
// ============================================================

function countMatches(
  studentValues,
  eventText
) {
  if (
    !studentValues ||
    studentValues.length === 0
  ) {
    return 0;
  }

  return studentValues.filter(
    (value) => {
      if (!value) {
        return false;
      }

      return (
        eventText.includes(value) ||
        value
          .split(/\s+/)
          .some(
            (word) =>
              word.length >= 3 &&
              eventText.includes(word)
          )
      );
    }
  ).length;
}



// ============================================================
// CALCULATE SKILL MATCH
// ============================================================

function calculateSkillMatch(
  studentFeatures,
  event
) {
  const studentSkills =
    studentFeatures.skills;

  if (
    studentSkills.length === 0
  ) {
    return 0;
  }

  const eventSkills =
    toArray(event.skills);

  const eventText =
    getEventText(event);

  let matches = 0;

  studentSkills.forEach(
    (skill) => {
      const exactSkillMatch =
        eventSkills.some(
          (eventSkill) =>
            eventSkill.includes(skill) ||
            skill.includes(eventSkill)
        );

      const textMatch =
        eventText.includes(skill);

      if (
        exactSkillMatch ||
        textMatch
      ) {
        matches += 1;
      }
    }
  );

  return Math.min(
    100,
    (matches / studentSkills.length) *
      100
  );
}



// ============================================================
// CALCULATE INTEREST MATCH
// ============================================================

function calculateInterestMatch(
  studentFeatures,
  event
) {
  const interests = [
    ...studentFeatures.interests,
    ...studentFeatures.domains,
    ...studentFeatures.preferredDomains,
  ];

  if (
    interests.length === 0
  ) {
    return 0;
  }

  const eventText =
    getEventText(event);

  const matches =
    countMatches(
      interests,
      eventText
    );

  return Math.min(
    100,
    (matches / interests.length) *
      100
  );
}



// ============================================================
// CALCULATE CAREER MATCH
// ============================================================

function calculateCareerMatch(
  studentFeatures,
  event
) {
  if (
    !studentFeatures.careerGoal
  ) {
    return 0;
  }

  const eventText =
    getEventText(event);

  const careerWords =
    studentFeatures.careerGoal
      .split(/\s+/)
      .filter(
        (word) =>
          word.length >= 3
      );

  if (
    careerWords.length === 0
  ) {
    return 0;
  }

  const matches =
    careerWords.filter(
      (word) =>
        eventText.includes(word)
    ).length;

  return Math.min(
    100,
    (matches / careerWords.length) *
      100
  );
}



// ============================================================
// CALCULATE DOMAIN / CATEGORY MATCH
// ============================================================

function calculateCategoryMatch(
  studentFeatures,
  event
) {
  const preferences = [
    ...studentFeatures.domains,
    ...studentFeatures.preferredDomains,
  ];

  if (
    preferences.length === 0
  ) {
    return 0;
  }

  const category =
    normalizeText(
      event.category
    );

  const matches =
    preferences.filter(
      (preference) =>
        category.includes(
          preference
        ) ||
        preference.includes(
          category
        )
    ).length;

  return Math.min(
    100,
    (matches / preferences.length) *
      100
  );
}



// ============================================================
// ORIGINAL CONTENT-BASED SCORE
// ============================================================
// This is intentionally retained as the baseline/fallback.
//
// Skills       = 35%
// Interests    = 30%
// Career goal  = 20%
// Category     = 15%

function calculateMatchScore(
  student,
  event
) {
  const features =
    getStudentFeatures(
      student
    );

  const skillScore =
    calculateSkillMatch(
      features,
      event
    );

  const interestScore =
    calculateInterestMatch(
      features,
      event
    );

  const careerScore =
    calculateCareerMatch(
      features,
      event
    );

  const categoryScore =
    calculateCategoryMatch(
      features,
      event
    );

  const total =
    skillScore * 0.35 +
    interestScore * 0.30 +
    careerScore * 0.20 +
    categoryScore * 0.15;

  return {
    score: Math.round(
      Math.min(100, total)
    ),

    skillScore: Math.round(
      skillScore
    ),

    interestScore: Math.round(
      interestScore
    ),

    careerScore: Math.round(
      careerScore
    ),

    categoryScore: Math.round(
      categoryScore
    ),
  };
}



// ============================================================
// SEMANTIC SCORE
// ============================================================
// The actual sentence-transformer embedding is generated by the
// backend.
//
// Backend can return:
// semantic_score
// semanticScore
// embedding_score
// vector_similarity
//
// If unavailable, a lightweight lexical-semantic fallback is used.

function calculateFallbackSemanticScore(
  student,
  event
) {
  const studentText =
    getStudentSemanticText(
      student
    );

  const eventText =
    getEventSemanticText(
      event
    );

  if (
    !studentText ||
    !eventText
  ) {
    return 0;
  }

  const studentWords =
    new Set(
      studentText
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 3
        )
    );

  const eventWords =
    new Set(
      eventText
        .split(/\s+/)
        .filter(
          (word) =>
            word.length >= 3
        )
    );

  if (
    studentWords.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  studentWords.forEach(
    (word) => {
      if (
        eventWords.has(word)
      ) {
        intersection += 1;
      }
    }
  );

  const union =
    new Set([
      ...studentWords,
      ...eventWords,
    ]).size;

  if (union === 0) {
    return 0;
  }

  return clampScore(
    (intersection / union) * 100
  );
}



// ============================================================
// IMPLICIT FEEDBACK
// ============================================================
// Feedback signals:
//   Saved       = 1
//   Registered  = 2
//   Attended    = 3
//
// Backend may provide a normalized feedback_score directly.

function getFeedbackScore(
  raw = {},
  feedback = {}
) {
  const backendScore =
    raw.feedback_score ??
    raw.feedbackScore ??
    raw.breakdown?.feedback;

  if (
    backendScore !== undefined &&
    backendScore !== null
  ) {
    return clampScore(
      backendScore
    );
  }

  const eventId = String(
    raw._id ??
    raw.id ??
    ""
  );

  if (!eventId) {
    return 0;
  }

  const saved =
    feedback.savedEventIds || [];

  const registered =
    feedback.registeredEventIds || [];

  const attended =
    feedback.attendedEventIds || [];

  if (
    attended.map(String).includes(eventId)
  ) {
    return 100;
  }

  if (
    registered.map(String).includes(eventId)
  ) {
    return 75;
  }

  if (
    saved.map(String).includes(eventId)
  ) {
    return 45;
  }

  return 0;
}



// ============================================================
// TIMETABLE UTILITIES
// ============================================================

function getDayName(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {
    return date
      .toLocaleDateString(
        "en-US",
        {
          weekday: "long",
        }
      )
      .toLowerCase();
  }

  return normalizeText(
    value
  );
}



// ============================================================
// EVENT DATE / DAY
// ============================================================

function getEventDay(event) {
  return (
    normalizeText(
      event.day ||
      event.dayName ||
      event.weekday ||
      ""
    ) ||
    getDayName(event.date)
  );
}



// ============================================================
// TIMETABLE CONFLICT CHECK
// ============================================================

function hasTimetableConflict(
  event,
  timetable
) {
  if (
    !Array.isArray(timetable) ||
    timetable.length === 0
  ) {
    return false;
  }

  const eventDay =
    getEventDay(event);

  const eventStart =
    safeNumber(
      event.s,
      parseTime(event.time).start
    );

  const eventEnd =
    safeNumber(
      event.e,
      parseTime(event.time).end
    );

  return timetable.some(
    (slot) => {
      const slotDay =
        normalizeText(
          slot.day ||
          slot.dayName ||
          slot.weekday ||
          ""
        );

      if (
        slotDay &&
        eventDay &&
        !slotDay.includes(eventDay) &&
        !eventDay.includes(slotDay)
      ) {
        return false;
      }

      const slotStart =
        safeNumber(
          slot.start ??
          slot.startTime ??
          slot.s,
          -1
        );

      const slotEnd =
        safeNumber(
          slot.end ??
          slot.endTime ??
          slot.e,
          -1
        );

      if (
        slotStart < 0 ||
        slotEnd < 0
      ) {
        return false;
      }

      return (
        eventStart < slotEnd &&
        eventEnd > slotStart
      );
    }
  );
}



// ============================================================
// TIMETABLE-AWARE SCORE
// ============================================================
// No conflict = 100
// Conflict     = 0
// Unknown      = 50

function calculateTimetableScore(
  raw,
  event,
  timetable
) {
  if (
    raw.timetable_score !== undefined
  ) {
    return clampScore(
      raw.timetable_score
    );
  }

  if (
    raw.timetableScore !== undefined
  ) {
    return clampScore(
      raw.timetableScore
    );
  }

  if (
    raw.breakdown?.timetable !== undefined
  ) {
    return clampScore(
      raw.breakdown.timetable
    );
  }

  if (
    !Array.isArray(timetable) ||
    timetable.length === 0
  ) {
    return 50;
  }

  return hasTimetableConflict(
    event,
    timetable
  )
    ? 0
    : 100;
}



// ============================================================
// AVAILABILITY SCORE
// ============================================================

function calculateAvailabilityScore(
  raw,
  event
) {
  const backend =
    raw.availability_score ??
    raw.availabilityScore ??
    raw.breakdown?.availabilityScore;

  if (
    backend !== undefined &&
    backend !== null
  ) {
    return clampScore(
      backend
    );
  }

  const seats =
    safeNumber(
      event.seats,
      0
    );

  const capacity =
    safeNumber(
      event.capacity,
      0
    );

  if (
    capacity <= 0
  ) {
    return 100;
  }

  if (
    seats <= 0
  ) {
    return 0;
  }

  return clampScore(
    (seats / capacity) *
      100
  );
}



// ============================================================
// CONTEXT SCORE
// ============================================================
// Combines timetable, availability and contextual signals.

function calculateContextScore(
  timetableScore,
  availabilityScore,
  raw = {}
) {
  if (
    raw.context_score !== undefined
  ) {
    return clampScore(
      raw.context_score
    );
  }

  if (
    raw.contextScore !== undefined
  ) {
    return clampScore(
      raw.contextScore
    );
  }

  return clampScore(
    timetableScore * 0.60 +
    availabilityScore * 0.40
  );
}



// ============================================================
// DIVERSITY PENALTY
// ============================================================

function applyDiversityReranking(
  results,
  diversityWeight = 0.08
) {
  if (
    !Array.isArray(results) ||
    results.length <= 1
  ) {
    return results;
  }

  const categoryCounts = {};

  results.forEach(
    (item) => {
      const category =
        normalizeText(
          item.event?.cat ||
          item.event?.category ||
          "other"
        );

      categoryCounts[category] =
        (categoryCounts[category] || 0) + 1;
    }
  );

  results.forEach(
    (item) => {
      const category =
        normalizeText(
          item.event?.cat ||
          item.event?.category ||
          "other"
        );

      const count =
        categoryCounts[category] || 1;

      const penalty =
        Math.max(
          0,
          count - 1
        ) *
        100 *
        diversityWeight;

      item.diversityPenalty =
        Math.round(
          penalty
        );

      item.rerankedScore =
        clampScore(
          item.matchScore -
          penalty
        );
    }
  );

  return results;
}



// ============================================================
// CONTEXT-AWARE RERANKING
// ============================================================

function applyContextReranking(
  results
) {
  if (
    !Array.isArray(results)
  ) {
    return [];
  }

  results.forEach(
    (item) => {
      const base =
        safeNumber(
          item.matchScore,
          0
        );

      const context =
        safeNumber(
          item.contextScore,
          50
        );

      const feedback =
        safeNumber(
          item.feedbackScore,
          0
        );

      const semantic =
        safeNumber(
          item.semanticScore,
          0
        );

      // Context-aware reranking:
      //
      // Base recommendation = 60%
      // Semantic relevance  = 15%
      // Feedback           = 10%
      // Context            = 15%

      item.contextRerankedScore =
        clampScore(
          base * 0.60 +
          semantic * 0.15 +
          feedback * 0.10 +
          context * 0.15
        );
    }
  );

  return results;
}



// ============================================================
// GENERATE RECOMMENDATION REASONS
// ============================================================

function generateReasons(
  scores,
  student,
  event
) {
  const reasons = [];

  const features =
    getStudentFeatures(
      student
    );

  if (
    scores.skillScore >= 50
  ) {
    reasons.push(
      "Matches your skills"
    );
  }

  if (
    scores.interestScore >= 50
  ) {
    reasons.push(
      "Matches your interests"
    );
  }

  if (
    scores.careerScore >= 50
  ) {
    reasons.push(
      "Supports your career goal"
    );
  }

  if (
    scores.categoryScore >= 50
  ) {
    reasons.push(
      "Matches your preferred domain"
    );
  }

  if (
    scores.semanticScore >= 60
  ) {
    reasons.push(
      "Semantically relevant to your profile"
    );
  }

  if (
    scores.feedbackScore >= 70
  ) {
    reasons.push(
      "Based on your previous event activity"
    );
  }

  if (
    scores.timetableScore >= 90
  ) {
    reasons.push(
      "Fits your timetable"
    );
  }

  if (
    scores.availabilityScore >= 70
  ) {
    reasons.push(
      "Seats are available"
    );
  }

  if (
    reasons.length === 0
  ) {
    if (
      features.skills.length === 0 &&
      features.interests.length === 0 &&
      !features.careerGoal
    ) {
      reasons.push(
        "Complete your profile for better recommendations"
      );
    } else {
      reasons.push(
        "Potentially useful campus opportunity"
      );
    }
  }

  return reasons.slice(0, 3);
}



// ============================================================
// NORMALIZE EVENT
// ============================================================

export function normalizeEvent(
  raw,
  index = 0
) {
  const {
    start,
    end,
  } = parseTime(
    raw?.time ||
    raw?.timeRange
  );

  const id =
    raw?._id ??
    raw?.id ??
    `event-${index}`;

  const category =
    raw?.category ||
    raw?.cat ||
    "Other";

  const capacity =
    safeNumber(
      raw?.capacity ??
      raw?.max_capacity ??
      raw?.maxCapacity,
      0
    );

  const registered =
    safeNumber(
      raw?.registered ??
      raw?.registered_count ??
      raw?.registeredCount,
      0
    );

  let seats =
    raw?.seats ??
    raw?.available_seats ??
    raw?.availableSeats;

  if (
    seats === undefined ||
    seats === null
  ) {
    seats =
      capacity > 0
        ? Math.max(
            0,
            capacity - registered
          )
        : 0;
  }

  return {
    id,

    title:
      raw?.title ||
      "Untitled Event",

    cat: category,

    category,

    org:
      raw?.organizer ||
      raw?.org ||
      "Campus Organizer",

    organizer:
      raw?.organizer ||
      raw?.org ||
      "Campus Organizer",

    date:
      raw?.date,

    s: Number(
      raw?.s ?? start
    ),

    e: Number(
      raw?.e ?? end
    ),

    time:
      raw?.time ||
      raw?.timeRange ||
      "",

    venue:
      raw?.location ||
      raw?.venue ||
      "Venue not specified",

    location:
      raw?.location ||
      raw?.venue ||
      "Venue not specified",

    type:
      raw?.type ||
      "Event",

    mode:
      raw?.mode ||
      (
        String(
          raw?.location || ""
        )
          .toLowerCase()
          .includes("online")
          ? "Online"
          : "Offline"
      ),

    skills:
      Array.isArray(raw?.skills)
        ? raw.skills
        : toArray(raw?.skills),

    dept:
      raw?.department ||
      raw?.dept ||
      "All",

    department:
      raw?.department ||
      raw?.dept ||
      "All",

    yrs:
      raw?.years ||
      raw?.yrs ||
      "All",

    capacity,

    registered,

    seats: safeNumber(
      seats,
      0
    ),

    dl:
      raw?.deadline ||
      raw?.dl ||
      raw?.date,

    em:
      raw?.em ||
      CATEGORY_EMOJI[
        category
      ] ||
      "✨",

    hue:
      raw?.hue ||
      CATEGORY_HUE[
        category
      ] ||
      230,

    desc:
      raw?.description ||
      raw?.desc ||
      "",

    description:
      raw?.description ||
      raw?.desc ||
      "",

    day:
      raw?.day ||
      raw?.dayName ||
      raw?.weekday ||
      getDayName(raw?.date),

    // Preserve backend metadata
    semantic_score:
      raw?.semantic_score ??
      raw?.semanticScore ??
      null,

    vector_similarity:
      raw?.vector_similarity ??
      raw?.vectorSimilarity ??
      null,

    recommendationModel:
      raw?.recommendationModel ??
      raw?.algorithm ??
      null,
  };
}



// ============================================================
// EXTRACT BACKEND SCORE
// ============================================================

function getBackendScore(raw) {
  const value =
    raw?.matchScore ??
    raw?.recommendation_score ??
    raw?.recommendationScore ??
    null;

  // A missing score means "the backend did not score this event".
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const score = Number(value);

  // A score of 0 is a real backend answer ("no match"), so it is kept.
  if (!Number.isFinite(score) || score < 0) {
    return null;
  }

  return clampScore(score);
}



// ============================================================
// EXTRACT MLP SCORE
// ============================================================

function getMLPScore(
  raw
) {
  return (
    raw?.mlp_score ??
    raw?.mlpScore ??
    raw?.ranker_score ??
    raw?.rankerScore ??
    raw?.breakdown?.mlp ??
    null
  );
}



// ============================================================
// EXTRACT SEMANTIC SCORE
// ============================================================

function getSemanticScore(
  raw,
  student,
  event
) {
  const backend =
    raw?.semantic_score ??
    raw?.semanticScore ??
    raw?.embedding_score ??
    raw?.embeddingScore ??
    raw?.vector_similarity ??
    raw?.vectorSimilarity ??
    raw?.breakdown?.semantic;

  if (
    backend !== undefined &&
    backend !== null
  ) {
    return clampScore(
      backend
    );
  }

  return calculateFallbackSemanticScore(
    student,
    event
  );
}



// ============================================================
// EXTRACT CONTENT SCORE
// ============================================================

function getContentScore(
  raw,
  fallbackScores
) {
  return clampScore(
    raw?.content_score ??
    raw?.contentScore ??
    raw?.breakdown?.content ??
    fallbackScores.score
  );
}



// ============================================================
// HYBRID SCORE
// ============================================================
// Used only when the backend does not provide a final score.
//
// Hybrid:
//   Semantic       = 35%
//   Content        = 20%
//   Feedback       = 15%
//   Timetable      = 15%
//   Availability   = 10%
//   Skill          = 5%
//
// This is the upgraded fallback architecture.

function calculateHybridFallbackScore(scores) {
  const total =
    scores.contentScore * 0.30 +
    scores.semanticScore * 0.30 +
    scores.feedbackScore * 0.15 +
    scores.timetableScore * 0.10 +
    scores.availabilityScore * 0.10 +
    scores.contextScore * 0.05;

  return clampScore(total);
}



// ============================================================
// BUILD RECOMMENDATIONS
// ============================================================

export function buildRecommendations(
  student,
  recommendedEvents,
  allEvents,
  options = {}
) {
  const source =
  Array.isArray(allEvents) &&
  allEvents.length
    ? allEvents
    : (
        Array.isArray(recommendedEvents)
          ? recommendedEvents
          : []
      );

  const timetable =
    Array.isArray(
      options.timetable
    )
      ? options.timetable
      : [];

  const feedback =
    options.feedback || {
      savedEventIds: [],
      registeredEventIds: [],
      attendedEventIds: [],
    };

  const results =
    source.map(
      (raw, index) => {
        const event =
          normalizeEvent(
            raw,
            index
          );
          console.log("===== RECOMMENDATION DEBUG =====");
          console.log("STUDENT:", student);
          console.log("NORMALIZED EVENT:", event);
          console.log("STUDENT FEATURES:", getStudentFeatures(student));
          console.log("EVENT TITLE:", event.title);
          console.log("EVENT CATEGORY:", event.category);
          console.log("EVENT SKILLS:", event.skills);
          console.log("================================");
        // ----------------------------------------------------
        // Original content score
        // ----------------------------------------------------

        const originalScores =
          calculateMatchScore(
            student,
            event
          );

        // ----------------------------------------------------
        // Semantic similarity
        // ----------------------------------------------------

        const semanticScore =
          getSemanticScore(
            raw,
            student,
            event
          );

        // ----------------------------------------------------
        // Content score
        // ----------------------------------------------------

        const contentScore =
          getContentScore(
            raw,
            originalScores
          );

        // ----------------------------------------------------
        // Feedback score
        // ----------------------------------------------------

        const feedbackScore =
          getFeedbackScore(
            raw,
            feedback
          );

        // ----------------------------------------------------
        // Timetable score
        // ----------------------------------------------------

        const timetableScore =
          calculateTimetableScore(
            raw,
            event,
            timetable
          );

        // ----------------------------------------------------
        // Availability score
        // ----------------------------------------------------

        const availabilityScore =
          calculateAvailabilityScore(
            raw,
            event
          );

        // ----------------------------------------------------
        // Context score
        // ----------------------------------------------------

        const contextScore =
          calculateContextScore(
            timetableScore,
            availabilityScore,
            raw
          );

        // ----------------------------------------------------
        // Backend / MLP ranking score
        // ----------------------------------------------------

        const backendScore =
          getBackendScore(
            raw
          );

        const mlpScore =
          getMLPScore(
            raw
          );

        let finalScore;

        let scoringMethod;

        // ----------------------------------------------------
        // BACKEND HYBRID MODEL
        // ----------------------------------------------------

        if (
          backendScore !== null &&
          backendScore !== undefined
        ) {
          finalScore =
            clampScore(
              backendScore
            );

          scoringMethod =
            "backend-hybrid-recommendation";
        }

        // ----------------------------------------------------
        // MLP RANKER
        // ----------------------------------------------------

        else if (
          mlpScore !== null &&
          mlpScore !== undefined
        ) {
          finalScore =
            clampScore(
              mlpScore
            );

          scoringMethod =
            "mlp-ranker";
        }

        // ----------------------------------------------------
        // FRONTEND HYBRID FALLBACK
        // ----------------------------------------------------

        else {
          finalScore =
            calculateHybridFallbackScore({
              ...originalScores,
              semanticScore,
              contentScore,
              feedbackScore,
              timetableScore,
              availabilityScore,
            });

          scoringMethod =
            "hybrid-content-semantic-context";
        }

        // ----------------------------------------------------
        // Recommendation reasons
        // ----------------------------------------------------

        const reasons =
          generateReasons(
            {
              ...originalScores,
              semanticScore,
              contentScore,
              feedbackScore,
              timetableScore,
              availabilityScore,
            },
            student,
            event
          );

        return {
          eventId:
            event.id,

          event,

          matchScore:
            finalScore,

          recommendationScore:
            finalScore,

          recommendationReason:
            reasons,

          availability:
            raw?.availability ||
            (
              event.seats > 0
                ? "free"
                : "limited"
            ),

          // Minute-accurate schedule check done by the backend
          scheduleStatus:
            raw?.schedule_status ?? null,

          scheduleDetail:
            raw?.schedule_detail ?? null,

          ranking:
            safeNumber(
              raw?.ranking,
              0
            ),

          // --------------------------------------------------
          // Existing breakdown
          // --------------------------------------------------

          breakdown: {
            skills:
              originalScores.skillScore,

            interests:
              originalScores.interestScore,

            careerGoal:
              originalScores.careerScore,

            category:
              originalScores.categoryScore,

            // ------------------------------------------------
            // New methodology scores
            // ------------------------------------------------

            semantic:
              semanticScore,

            content:
              contentScore,

            feedback:
              feedbackScore,

            timetable:
              timetableScore,

            availabilityScore:
              availabilityScore,

            context:
              contextScore,

            mlp:
              mlpScore !== null
                ? clampScore(
                    mlpScore
                  )
                : 0,
          },

          skillScore:
            originalScores.skillScore,

          interestScore:
            originalScores.interestScore,

          careerScore:
            originalScores.careerScore,

          categoryScore:
            originalScores.categoryScore,

          semanticScore,

          contentScore,

          feedbackScore,

          timetableScore,

          availabilityScore,

          contextScore,

          mlpScore:
            mlpScore !== null
              ? clampScore(
                  mlpScore
                )
              : null,

          scoringMethod,

          recommendationModel:
            raw?.recommendationModel ??
            raw?.algorithm ??
            "Hybrid Recommendation Engine",

          vectorSimilarity:
            safeNumber(
              raw?.vector_similarity ??
              raw?.vectorSimilarity,
              0
            ),

          semanticEmbeddingUsed:
            Boolean(
              raw?.semantic_score ??
              raw?.semanticScore ??
              raw?.embedding_score ??
              raw?.embeddingScore
            ),

          implicitFeedbackUsed:
            feedbackScore > 0,

          timetableAware:
            timetable.length > 0,

          contextAware:
            true,

          diversityAware:
            false,

          evaluationReady:
            true,
        };
      }
    );



  // ==========================================================
  // BACKEND RANKING
  // ==========================================================

  const hasBackendRanking =
    results.some(
      (item) =>
        item.ranking > 0
    );

  if (
    hasBackendRanking
  ) {
    results.sort(
      (a, b) => {
        if (
          a.ranking > 0 &&
          b.ranking > 0
        ) {
          return (
            a.ranking -
            b.ranking
          );
        }

        return (
          b.matchScore -
          a.matchScore
        );
      }
    );
  } else {
    results.sort(
      (a, b) =>
        b.matchScore -
        a.matchScore
    );
  }



  // ==========================================================
  // CONTEXT-AWARE RERANKING
  // ==========================================================

  applyContextReranking(
    results
  );



  // ==========================================================
  // DIVERSITY-AWARE RERANKING
  // ==========================================================

  applyDiversityReranking(
    results
  );



  // ==========================================================
  // FINAL RANKING
  // ==========================================================
  // If backend already supplied a ranking, preserve it.
  //
  // Otherwise use context + diversity score.

  if (
    !hasBackendRanking
  ) {
    results.sort(
      (a, b) => {
        const scoreA =
          safeNumber(
            a.rerankedScore ??
            a.contextRerankedScore ??
            a.matchScore,
            0
          );

        const scoreB =
          safeNumber(
            b.rerankedScore ??
            b.contextRerankedScore ??
            b.matchScore,
            0
          );

        return (
          scoreB -
          scoreA
        );
      }
    );
  }



  // ==========================================================
  // ASSIGN FINAL RANKINGS
  // ==========================================================

  results.forEach(
    (item, index) => {
      item.ranking =
        index + 1;

      item.finalRank =
        index + 1;

      item.diversityAware =
        true;
    }
  );



  return results;
}



// ============================================================
// PREPARE DASHBOARD DATA
// ============================================================

export function prepareDashboardData(
  student,
  dashboardData,
  allEvents = [],
  options = {}
) {
  // The backend engine is the single source of truth. If it ran without an
  // error ("ok") and returned nothing, then nothing is eligible right now:
  // do NOT re-score every event in the browser (that produced "0% Match" cards).
  const backendRan =
    dashboardData?.engine_status === "ok" &&
    Array.isArray(dashboardData?.recommended);

  const rawRecommended = backendRan
    ? dashboardData.recommended
    : Array.isArray(dashboardData?.recommended) &&
        dashboardData.recommended.length > 0
      ? dashboardData.recommended
      : Array.isArray(allEvents)
        ? allEvents
        : [];

  const rawUpcoming =
    Array.isArray(
      dashboardData?.upcoming
    )
      ? dashboardData.upcoming
      : [];



  // ----------------------------------------------------------
  // Combine all event sources
  // ----------------------------------------------------------

  const combined = [
    ...allEvents,
    ...rawRecommended,
    ...rawUpcoming,
  ];



  // ----------------------------------------------------------
  // Remove duplicate events
  // ----------------------------------------------------------

  const eventMap =
    new Map();

  combined.forEach(
    (event, index) => {
      const normalized =
        normalizeEvent(
          event,
          index
        );

      eventMap.set(
        String(
          normalized.id
        ),
        normalized
      );
    }
  );

  const events =
    [
      ...eventMap.values()
    ];



  // ----------------------------------------------------------
  // Recommendation options
  // ----------------------------------------------------------

  const recommendationOptions = {
    ...options,

    // Backend feedback data can be passed here
    feedback:
      options.feedback ||
      {
        savedEventIds:
          dashboardData?.savedEventIds ||
          [],

        registeredEventIds:
          dashboardData?.registeredEventIds ||
          [],

        attendedEventIds:
          dashboardData?.attendedEventIds ||
          [],
      },

    // Timetable can come from dashboardData
    timetable:
      options.timetable ||
      dashboardData?.timetable ||
      [],
  };



  // ----------------------------------------------------------
  // Recommendation metadata
  // ----------------------------------------------------------

  const recommendations =
  buildRecommendations(
    student,
    rawRecommended,
    rawRecommended,
    recommendationOptions
  );



  // ----------------------------------------------------------
  // Upcoming events
  // ----------------------------------------------------------

  const upcoming =
    rawUpcoming.map(
      (event, index) =>
        normalizeEvent(
          event,
          index
        )
    );



  // ----------------------------------------------------------
  // Algorithm metadata
  // ----------------------------------------------------------

  const algorithm =
    dashboardData?.algorithm ||
    dashboardData?.recommendationAlgorithm ||
    {
      studentFeatureEngineering:
        true,

      contentBasedMatching:
        true,

      weightedScoring:
        true,

      sentenceEmbeddings:
        recommendations.some(
          (item) =>
            item.semanticEmbeddingUsed
        ),

      semanticEventEmbeddings:
        recommendations.some(
          (item) =>
            item.semanticEmbeddingUsed
        ),

      vectorRetrieval:
        recommendations.some(
          (item) =>
            item.vectorSimilarity > 0
        ),

      implicitFeedback:
        recommendations.some(
          (item) =>
            item.implicitFeedbackUsed
        ),

      mlpRanker:
        recommendations.some(
          (item) =>
            item.mlpScore !== null
        ),

      timetableAware:
        recommendations.some(
          (item) =>
            item.timetableAware
        ),

      contextAwareReranking:
        true,

      diversityReranking:
        true,
    };



  return {
    events,

    recommendations,

    upcoming,

    algorithm,

    recommendationMetadata: {
      totalEvents:
        events.length,

      totalRecommendations:
        recommendations.length,

      semanticRecommendations:
        recommendations.filter(
          (item) =>
            item.semanticScore > 0
        ).length,

      feedbackAwareRecommendations:
        recommendations.filter(
          (item) =>
            item.feedbackScore > 0
        ).length,

      timetableAwareRecommendations:
        recommendations.filter(
          (item) =>
            item.timetableAware
        ).length,

      mlpRankedRecommendations:
        recommendations.filter(
          (item) =>
            item.mlpScore !== null
        ).length,

      diversityAware:
        true,

      contextAware:
        true,
    },
  };
}



// ============================================================
// RECOMMENDATION EVALUATION HELPERS
// ============================================================
// These functions allow the frontend to calculate basic
// evaluation metrics when actual relevant-item labels are
// available.
//
// For publication-grade evaluation, calculate these metrics
// on a held-out test dataset in the backend.


// ============================================================
// PRECISION @ K
// ============================================================

export function precisionAtK(
  recommendations = [],
  relevantEventIds = [],
  k = 5
) {
  const relevant =
    new Set(
      relevantEventIds.map(
        String
      )
    );

  const topK =
    recommendations
      .slice(0, k);

  if (
    topK.length === 0
  ) {
    return 0;
  }

  const hits =
    topK.filter(
      (item) =>
        relevant.has(
          String(
            item.eventId
          )
        )
    ).length;

  return hits /
    topK.length;
}



// ============================================================
// RECALL @ K
// ============================================================

export function recallAtK(
  recommendations = [],
  relevantEventIds = [],
  k = 5
) {
  const relevant =
    new Set(
      relevantEventIds.map(
        String
      )
    );

  if (
    relevant.size === 0
  ) {
    return 0;
  }

  const topK =
    recommendations
      .slice(0, k);

  const hits =
    topK.filter(
      (item) =>
        relevant.has(
          String(
            item.eventId
          )
        )
    ).length;

  return hits /
    relevant.size;
}



// ============================================================
// NDCG @ K
// ============================================================

export function ndcgAtK(
  recommendations = [],
  relevantEventIds = [],
  k = 5
) {
  const relevant =
    new Set(
      relevantEventIds.map(
        String
      )
    );

  const topK =
    recommendations
      .slice(0, k);

  let dcg = 0;

  topK.forEach(
    (item, index) => {
      const isRelevant =
        relevant.has(
          String(
            item.eventId
          )
        );

      if (
        isRelevant
      ) {
        dcg +=
          1 /
          Math.log2(
            index + 2
          );
      }
    }
  );

  const idealLength =
    Math.min(
      k,
      relevant.size
    );

  let idcg = 0;

  for (
    let i = 0;
    i < idealLength;
    i += 1
  ) {
    idcg +=
      1 /
      Math.log2(
        i + 2
      );
  }

  if (
    idcg === 0
  ) {
    return 0;
  }

  return dcg / idcg;
}



// ============================================================
// MAP @ K
// ============================================================

export function mapAtK(
  recommendations = [],
  relevantEventIds = [],
  k = 5
) {
  const relevant =
    new Set(
      relevantEventIds.map(
        String
      )
    );

  if (
    relevant.size === 0
  ) {
    return 0;
  }

  let hits = 0;
  let precisionSum = 0;

  recommendations
    .slice(0, k)
    .forEach(
      (item, index) => {
        if (
          relevant.has(
            String(
              item.eventId
            )
          )
        ) {
          hits += 1;

          precisionSum +=
            hits /
            (index + 1);
        }
      }
    );

  return (
    precisionSum /
    Math.min(
      relevant.size,
      k
    )
  );
}



// ============================================================
// DIVERSITY
// ============================================================
// Category-based intra-list diversity.

export function calculateDiversity(
  recommendations = [],
  k = 5
) {
  const topK =
    recommendations
      .slice(0, k);

  if (
    topK.length <= 1
  ) {
    return 0;
  }

  let differentPairs = 0;
  let totalPairs = 0;

  for (
    let i = 0;
    i < topK.length;
    i += 1
  ) {
    for (
      let j = i + 1;
      j < topK.length;
      j += 1
    ) {
      const categoryA =
        normalizeText(
          topK[i].event?.cat ||
          topK[i].event?.category ||
          "other"
        );

      const categoryB =
        normalizeText(
          topK[j].event?.cat ||
          topK[j].event?.category ||
          "other"
        );

      if (
        categoryA !== categoryB
      ) {
        differentPairs += 1;
      }

      totalPairs += 1;
    }
  }

  if (
    totalPairs === 0
  ) {
    return 0;
  }

  return (
    differentPairs /
    totalPairs
  );
}



// ============================================================
// COVERAGE
// ============================================================

export function calculateCoverage(
  recommendations = [],
  allEvents = []
) {
  if (
    !Array.isArray(allEvents) ||
    allEvents.length === 0
  ) {
    return 0;
  }

  const recommendedIds =
    new Set(
      recommendations.map(
        (item) =>
          String(
            item.eventId
          )
      )
    );

  return (
    recommendedIds.size /
    allEvents.length
  );
}



// ============================================================
// EVALUATE RECOMMENDATIONS
// ============================================================

export function evaluateRecommendations(
  recommendations = [],
  relevantEventIds = [],
  allEvents = [],
  k = 5
) {
  return {
    k,

    precisionAtK:
      precisionAtK(
        recommendations,
        relevantEventIds,
        k
      ),

    recallAtK:
      recallAtK(
        recommendations,
        relevantEventIds,
        k
      ),

    ndcgAtK:
      ndcgAtK(
        recommendations,
        relevantEventIds,
        k
      ),

    mapAtK:
      mapAtK(
        recommendations,
        relevantEventIds,
        k
      ),

    diversity:
      calculateDiversity(
        recommendations,
        k
      ),

    coverage:
      calculateCoverage(
        recommendations,
        allEvents
      ),
  };
}



// ============================================================
// EXPORT ALGORITHM DESCRIPTION
// ============================================================

export const RECOMMENDATION_ALGORITHM = {
  name:
    "Hybrid Semantic-Behavioral Context-Aware Recommendation",

  baseline: {
    type:
      "Content-Based Recommendation",

    methods: [
      "Student Feature Engineering",
      "Keyword Matching",
      "Skill Matching",
      "Interest Matching",
      "Career Goal Matching",
      "Category/Domain Matching",
      "Weighted Rule-Based Scoring",
      "Score-Based Ranking",
    ],

    weights: {
      skills: 0.35,
      interests: 0.30,
      careerGoal: 0.20,
      category: 0.15,
    },
  },

  advanced: {
    methods: [
      "Sentence Embeddings",
      "Semantic Event Embeddings",
      "Vector/Semantic Retrieval",
      "Implicit Feedback",
      "MLP Ranking",
      "Timetable-Aware Recommendation",
      "Availability-Aware Recommendation",
      "Context-Aware Re-Ranking",
      "Diversity-Aware Re-Ranking",
    ],
  },

  evaluation: [
    "Precision@K",
    "Recall@K",
    "NDCG@K",
    "MAP@K",
    "Diversity",
    "Coverage",
  ],

  architecture:
    "Student Profile → Feature Engineering → Semantic Representation → Vector Retrieval → Hybrid Scoring → Behavioral Feedback → MLP Ranking → Timetable/Context Re-ranking → Diversity → Top-K",
};



// ============================================================
// DEFAULT EXPORT
// ============================================================

export default {
  normalizeEvent,
  buildRecommendations,
  prepareDashboardData,
  getStudentSemanticText,
  getEventSemanticText,
  precisionAtK,
  recallAtK,
  ndcgAtK,
  mapAtK,
  calculateDiversity,
  calculateCoverage,
  evaluateRecommendations,
  RECOMMENDATION_ALGORITHM,
};