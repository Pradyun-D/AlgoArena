import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Editor from "@monaco-editor/react";
import ErrorPage from "./ErrorPage";
import LoadingPage from "./LoadingPage";
import { API_BASE_URL } from "../Utils/api";
import { useTheme } from "../Theme/ThemeProvider";
import ArenaNavbar from "../Components/ArenaNavbar";

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

    const loadSubmission = async () => {
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
    };

    useEffect(() => {
        if (submissionId) {
            loadSubmission();
        }
    }, [submissionId]);

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
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-primary text-on-primary rounded-sm font-bold text-sm uppercase tracking-wider hover:bg-primary/90 transition-colors"
                    >
                        Go Back
                    </button>
                )}
            />

            <main className="pt-24 pb-12 px-6 max-w-7xl mx-auto">
                <div className="bg-surface-container-high rounded-lg w-full flex flex-col shadow-2xl border border-outline-variant/20">
                    <div className="flex justify-between items-center p-4 border-b border-outline-variant/20">
                        <div>
                            <h2 className="text-lg font-bold font-headline">
                                Submission Details
                            </h2>
                            <p className="text-xs text-on-surface-variant">
                                {submission.problem_title} in {submission.contest_title}
                            </p>
                        </div>
                        <Link to={`/contest/${submission.contest_id}/problems/${submission.problem_id}`} className="admin-icon-button" aria-label="Go to Problem">
                            <span className="material-symbols-outlined">open_in_new</span>
                        </Link>
                    </div>
                    <div className="p-2 bg-background">
                        <Editor
                            height="70vh"
                            language={getLanguagePreset(submission.language_name).monacoLanguage}
                            value={submission.source_code}
                            theme={isDarkMode ? "vs-dark" : "vs"}
                            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, padding: { top: 16 } }}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

export default SubmissionViewPage;
