const mongoose = require('mongoose');

const LIMITED_STRING = {
    type: String,
    trim: true,
    maxlength: 180
};

const CONTENT_LEVEL_STRING = {
    type: String,
    trim: true,
    maxlength: 80
};

const ContentGuidelinesSchema = new mongoose.Schema({
    violenceLevel: CONTENT_LEVEL_STRING,
    romanceLevel: CONTENT_LEVEL_STRING,
    profanityLevel: CONTENT_LEVEL_STRING,
    sexualContentLevel: CONTENT_LEVEL_STRING,
    sensitiveTopics: {
        type: [LIMITED_STRING],
        default: []
    }
}, { _id: false });

const BookBriefSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: { unique: true }
    },
    genre: LIMITED_STRING,
    subgenre: LIMITED_STRING,
    targetAudience: LIMITED_STRING,
    language: {
        ...LIMITED_STRING,
        default: 'Português Brasileiro'
    },
    tone: LIMITED_STRING,
    narrativeVoice: LIMITED_STRING,
    corePromise: {
        type: String,
        trim: true,
        maxlength: 500
    },
    protagonistWant: {
        type: String,
        trim: true,
        maxlength: 500
    },
    protagonistNeed: {
        type: String,
        trim: true,
        maxlength: 500
    },
    centralConflict: {
        type: String,
        trim: true,
        maxlength: 500
    },
    readerAppeal: {
        type: [LIMITED_STRING],
        default: []
    },
    targetWordCount: {
        type: Number,
        min: 1
    },
    targetChapterCount: {
        type: Number,
        min: 1
    },
    monetizationMode: {
        ...LIMITED_STRING,
        default: 'undecided'
    },
    seriesName: LIMITED_STRING,
    bookNumber: {
        type: Number,
        min: 1
    },
    aiDisclosure: {
        ...LIMITED_STRING,
        default: 'not_configured'
    },
    humanReviewStatus: {
        ...LIMITED_STRING,
        default: 'not_tracked'
    },
    contentGuidelines: {
        type: ContentGuidelinesSchema,
        default: () => ({})
    },
    mustInclude: {
        type: [LIMITED_STRING],
        default: []
    },
    mustAvoid: {
        type: [LIMITED_STRING],
        default: []
    },
    comparableTitles: {
        type: [LIMITED_STRING],
        default: []
    },
    keywords: {
        type: [LIMITED_STRING],
        default: []
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 2000
    }
}, { timestamps: true });

module.exports = mongoose.model('BookBrief', BookBriefSchema);
