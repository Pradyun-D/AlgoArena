import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Editor from "@monaco-editor/react";
import { motion } from "motion/react";
import ErrorPage from "../Auth_and_Profile/ErrorPage";
import LoadingPage from "../Auth_and_Profile/LoadingPage";
import { API_BASE_URL } from "../../Utils/api";
import { useTheme } from "../../Theme/ThemeProvider";
import ArenaNavbar from "../../Components/ArenaNavbar";

const LANGUAGE_PRESETS = {
    "C++20": { monacoLanguage: "cpp" },
    "Python 3.11": { monacoLanguage: "python" },
    "Java 17": { monacoLanguage: "java" },
};

const getLanguagePreset = (languageName) => {
    const name = String(languageName || "");
    return LANGUAGE_PRESETS[name] || { monacoLanguage: "plaintext" };
};

function SubmissionViewPage() {
    const { submissionId } = useParams();
    const navigate = useNavigate();
    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const { isDarkMode } = useTheme();
    const navLinks = [
        { label: "Contests", to: "/contests", active: false },
        { label: "My Submissions", to: "/submissions", active: true },
    ];

    const loadSubmission = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const response = await axios.get(`${API_BASE_URL}/contests/submissions/${submissionId}/`, {
                withCredentials: true,
            });
            setSubmission(response.data);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                "Unable to load this submission."
            );
        } finally {
            setLoading(false);
        }
    }, [submissionId]);

    useEffect(() => {
        if (submissionId) {
            loadSubmission();
        }
    }, [submissionId, loadSubmission]);

    if (loading) {
        return (
            <LoadingPage
                title="Loading Submission"
                subtitle="Fetching submission source code and execution details from the arena."
            />
        );
    }

    if (error) {
        return (
            <ErrorPage
                kicker="Submission Error"
                code={error.includes("not found") ? "404" : "500"}
                title="This submission could not be loaded."
                copy={error}
                primaryAction={{ label: "Retry", onClick: loadSubmission }}
                secondaryAction={{ label: "Back to My Submissions", to: "/submissions" }}
            />
        );
    }

    if (!submission) {
        return <ErrorPage title="Submission not found." />;
    }

    return (
        <div className="bg-background text-on-background min-h-screen">
            <ArenaNavbar
                navLinks={navLinks}
                showAuthActions={false}
                className="bg-background/80 backdrop-blur-sm"
                rightContent={(
                    <motion.button
                        onClick={() => navigate(-1)}
                        aria-label="Go back to submissions"
                        className="inline-flex items-center gap-2 rounded-sm border border-outline-variant/20 bg-white px-3.5 py-2 text-primary shadow-sm transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-[1px] font-headline font-bold uppercase text-sm tracking-tight"
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 380, damping: 18 }}
                    >
                        <span className="material-symbols-outlined text-[18px] leading-none">arrow_back</span>
                        <span className="whitespace-nowrap">Back to Submissions</span>
                    </motion.button>
                )}
            />

            <motion.main
                className="pt-24 pb-12 px-6 max-w-7xl mx-auto"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
                <motion.div
                    className="bg-surface-container-high rounded-lg w-full flex flex-col shadow-2xl border border-outline-variant/20"
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.12, duration: 0.45, ease: "easeOut" }}
                    whileHover={{ y: -2 }}
                >
                    <motion.div
                        className="flex justify-between items-center p-4 border-b border-outline-variant/20"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.22, duration: 0.34 }}
                    >
                        <div>
                            <h2 className="text-lg font-bold font-headline">
                                Submission Details
                            </h2>
                            <p className="text-xs text-on-surface-variant">
                                {submission.problem_title} in {submission.contest_title}
                            </p>
                        </div>
                        <motion.div whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
                            <Link to={`/contest/${submission.contest_id}/problems/${submission.problem_id}`} className="admin-icon-button" aria-label="Go to Problem">
                                <span className="material-symbols-outlined">open_in_new</span>
                            </Link>
                        </motion.div>
                    </motion.div>
                    <motion.div
                        className="p-2 bg-background"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.32, duration: 0.42 }}
                    >
                        <Editor
                            height="70vh"
                            language={getLanguagePreset(submission.language_name).monacoLanguage}
                            value={submission.source_code}
                            theme={isDarkMode ? "vs-dark" : "vs"}
                            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, padding: { top: 16 } }}
                        />
                    </motion.div>
                </motion.div>
            </motion.main>
        </div>
    );
}

export default SubmissionViewPage;
