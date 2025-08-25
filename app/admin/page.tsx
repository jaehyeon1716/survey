"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Download, Edit, Search, X, Users, BarChart3, FileText, Settings } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AnswerOption {
  text: string
  score: number
}

interface QuestionData {
  question: string
  answers: AnswerOption[]
}

interface Survey {
  id: number
  title: string
  description: string
  is_active: boolean
  created_at: string
  survey_questions?: Array<{
    id: number
    question_text: string
    question_order: number
    answer_options?: AnswerOption[]
  }>
  participantCount?: number
}

interface Participant {
  id: number
  survey_id: number
  token: string
  hospital_name: string
  participant_name: string
  phone_number: string
  is_completed: boolean
  created_at: string
  completed_at?: string
}

interface SurveyResponse {
  id: number
  participant_id: number
  question_id: number
  answer_value: number
  answer_text: string
  created_at: string
  survey_participants?: {
    participant_name: string
    hospital_name: string
    phone_number: string
  }
}

interface QuestionStats {
  questionId: number
  questionText: string
  responseCount: number
  averageScore: number
  responses: Array<{
    value: number
    text: string
    count: number
  }>
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [activeTab, setActiveTab] = useState("create")
  const [hospitalFilter, setHospitalFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [hospitalSearchFilter, setHospitalSearchFilter] = useState("")
  const [questionFilter, setQuestionFilter] = useState("")

  // 설문지 생성 관련 상태
  const [newSurveyTitle, setNewSurveyTitle] = useState("")
  const [newSurveyDescription, setNewSurveyDescription] = useState("")
  const [newSurveyQuestions, setNewSurveyQuestions] = useState<QuestionData[]>([
    {
      question: "",
      answers: [
        { text: "매우 그렇다", score: 5 },
        { text: "그렇다", score: 4 },
        { text: "보통이다", score: 3 },
        { text: "그렇지 않다", score: 2 },
        { text: "전혀 그렇지 않다", score: 1 },
      ],
    },
  ])
  const [createLoading, setCreateLoading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState("")

  // 설문지 수정 관련 상태
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)

  // 삭제 관련 상태
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null)
  const [deletePassword, setDeletePassword] = useState("")

  // CSV 업로드 관련 상태
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === "hospital2024") {
      setIsAuthenticated(true)
      setError("")
      fetchSurveys()
    } else {
      setError("비밀번호가 올바르지 않습니다.")
    }
  }

  const fetchSurveys = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("surveys")
        .select(`
          *,
          survey_questions (
            id,
            question_text,
            question_order,
            answer_options
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      // 각 설문지의 참여자 수를 미리 계산
      const surveysWithParticipantCount = await Promise.all(
        (data || []).map(async (survey) => {
          const { count } = await supabase
            .from("survey_participants")
            .select("*", { count: "exact", head: true })
            .eq("survey_id", survey.id)

          return {
            ...survey,
            participantCount: count || 0,
          }
        }),
      )

      setSurveys(surveysWithParticipantCount)
    } catch (error) {
      console.error("설문지 조회 오류:", error)
      setError("설문지 데이터를 불러오는데 실패했습니다.")
    }
  }

  const fetchParticipants = async (surveyId: number) => {
    try {
      const response = await fetch(`/api/admin/surveys/${surveyId}/participants`)
      if (!response.ok) throw new Error("Failed to fetch participants")
      const data = await response.json()
      setParticipants(data)
    } catch (error) {
      console.error("참여자 조회 오류:", error)
      setError("참여자 데이터를 불러오는데 실패했습니다.")
    }
  }

  const fetchResponses = async (surveyId: number) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("survey_responses")
        .select(`
          *,
          survey_participants (
            participant_name,
            hospital_name,
            phone_number
          )
        `)
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setResponses(data || [])
    } catch (error) {
      console.error("응답 조회 오류:", error)
      setError("설문 응답 데이터를 불러오는데 실패했습니다.")
    }
  }

  const fetchQuestionStats = async (surveyId: number, hospitalFilter = "") => {
    try {
      const supabase = createClient()

      let query = supabase
        .from("survey_responses")
        .select(`
          question_id,
          answer_value,
          answer_text,
          survey_questions!inner (
            question_text,
            question_order
          ),
          survey_participants!inner (
            hospital_name
          )
        `)
        .eq("survey_id", surveyId)

      if (hospitalFilter) {
        query = query.ilike("survey_participants.hospital_name", `%${hospitalFilter}%`)
      }

      const { data, error } = await query

      if (error) throw error

      // 문항별로 통계 계산
      const statsMap = new Map<number, QuestionStats>()

      data?.forEach((response) => {
        const questionId = response.question_id
        const questionText = response.survey_questions?.question_text || ""

        if (!statsMap.has(questionId)) {
          statsMap.set(questionId, {
            questionId,
            questionText,
            responseCount: 0,
            averageScore: 0,
            responses: [],
          })
        }

        const stat = statsMap.get(questionId)!
        stat.responseCount++

        // 응답별 카운트
        const existingResponse = stat.responses.find((r) => r.value === response.answer_value)
        if (existingResponse) {
          existingResponse.count++
        } else {
          stat.responses.push({
            value: response.answer_value,
            text: response.answer_text,
            count: 1,
          })
        }
      })

      // 평균 점수 계산
      statsMap.forEach((stat) => {
        const totalScore = stat.responses.reduce((sum, r) => sum + r.value * r.count, 0)
        stat.averageScore = stat.responseCount > 0 ? totalScore / stat.responseCount : 0
      })

      setQuestionStats(Array.from(statsMap.values()).sort((a, b) => a.questionId - b.questionId))
    } catch (error) {
      console.error("문항별 통계 조회 오류:", error)
      setQuestionStats([])
    }
  }

  // 설문지 선택 시 관련 데이터 로드
  useEffect(() => {
    if (selectedSurvey) {
      fetchParticipants(selectedSurvey.id)
      fetchResponses(selectedSurvey.id)
      fetchQuestionStats(selectedSurvey.id, hospitalSearchFilter)
    }
  }, [selectedSurvey])

  // 병원 검색 필터 변경 시 문항별 통계 다시 로드
  useEffect(() => {
    if (selectedSurvey && hospitalSearchFilter !== undefined) {
      fetchQuestionStats(selectedSurvey.id, hospitalSearchFilter)
    }
  }, [hospitalSearchFilter, selectedSurvey])

  const addQuestion = () => {
    setNewSurveyQuestions([
      ...newSurveyQuestions,
      {
        question: "",
        answers: [
          { text: "매우 그렇다", score: 5 },
          { text: "그렇다", score: 4 },
          { text: "보통이다", score: 3 },
          { text: "그렇지 않다", score: 2 },
          { text: "전혀 그렇지 않다", score: 1 },
        ],
      },
    ])
  }

  const removeQuestion = (index: number) => {
    if (newSurveyQuestions.length > 1) {
      setNewSurveyQuestions(newSurveyQuestions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, question: string) => {
    const updated = [...newSurveyQuestions]
    updated[index].question = question
    setNewSurveyQuestions(updated)
  }

  const addAnswer = (questionIndex: number) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers.push({ text: "", score: 1 })
    setNewSurveyQuestions(updated)
  }

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    const updated = [...newSurveyQuestions]
    if (updated[questionIndex].answers.length > 1) {
      updated[questionIndex].answers.splice(answerIndex, 1)
      setNewSurveyQuestions(updated)
    }
  }

  const updateAnswer = (questionIndex: number, answerIndex: number, field: "text" | "score", value: string) => {
    const updated = [...newSurveyQuestions]
    if (field === "text") {
      updated[questionIndex].answers[answerIndex].text = value
    } else {
      updated[questionIndex].answers[answerIndex].score = Number.parseInt(value) || 1
    }
    setNewSurveyQuestions(updated)
  }

  const handleCreateSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSurveyTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    setCreateLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEditMode ? editingSurvey?.id : undefined,
          title: newSurveyTitle,
          description: newSurveyDescription,
          questions: newSurveyQuestions,
        }),
      })

      if (!response.ok) throw new Error("설문지 저장 실패")

      setUploadSuccess(isEditMode ? "설문지가 성공적으로 수정되었습니다!" : "설문지가 성공적으로 생성되었습니다!")

      // 폼 초기화
      setNewSurveyTitle("")
      setNewSurveyDescription("")
      setNewSurveyQuestions([
        {
          question: "",
          answers: [
            { text: "매우 그렇다", score: 5 },
            { text: "그렇다", score: 4 },
            { text: "보통이다", score: 3 },
            { text: "그렇지 않다", score: 2 },
            { text: "전혀 그렇지 않다", score: 1 },
          ],
        },
      ])

      // 수정 모드 해제
      setIsEditMode(false)
      setEditingSurvey(null)

      // 설문지 목록 새로고침
      fetchSurveys()

      setTimeout(() => setUploadSuccess(""), 3000)
    } catch (error) {
      console.error("설문지 생성/수정 오류:", error)
      setError(isEditMode ? "설문지 수정에 실패했습니다." : "설문지 생성에 실패했습니다.")
    } finally {
      setCreateLoading(false)
    }
  }

  const startEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey)
    setIsEditMode(true)
    setNewSurveyTitle(survey.title)
    setNewSurveyDescription(survey.description)

    // 기존 문항들을 로드
    if (survey.survey_questions) {
      const questions = survey.survey_questions
        .sort((a, b) => a.question_order - b.question_order)
        .map((q) => ({
          question: q.question_text,
          answers: q.answer_options || [
            { text: "매우 그렇다", score: 5 },
            { text: "그렇다", score: 4 },
            { text: "보통이다", score: 3 },
            { text: "그렇지 않다", score: 2 },
            { text: "전혀 그렇지 않다", score: 1 },
          ],
        }))
      setNewSurveyQuestions(questions)
    }

    setActiveTab("create")
  }

  const cancelEdit = () => {
    setIsEditMode(false)
    setEditingSurvey(null)
    setNewSurveyTitle("")
    setNewSurveyDescription("")
    setNewSurveyQuestions([
      {
        question: "",
        answers: [
          { text: "매우 그렇다", score: 5 },
          { text: "그렇다", score: 4 },
          { text: "보통이다", score: 3 },
          { text: "그렇지 않다", score: 2 },
          { text: "전혀 그렇지 않다", score: 1 },
        ],
      },
    ])
  }

  const deleteSurvey = async () => {
    if (!surveyToDelete || deletePassword !== "hospital2024") {
      setError("관리자 비밀번호가 올바르지 않습니다.")
      return
    }

    try {
      const response = await fetch(`/api/admin/surveys`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: surveyToDelete.id }),
      })

      if (!response.ok) throw new Error("삭제 실패")

      setUploadSuccess("설문지가 성공적으로 삭제되었습니다!")
      setShowDeleteConfirm(false)
      setSurveyToDelete(null)
      setDeletePassword("")
      fetchSurveys()

      if (selectedSurvey?.id === surveyToDelete.id) {
        setSelectedSurvey(null)
      }

      setTimeout(() => setUploadSuccess(""), 3000)
    } catch (error) {
      console.error("설문지 삭제 오류:", error)
      setError("설문지 삭제에 실패했습니다.")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/csv") {
      setCsvFile(file)
    } else {
      setError("CSV 파일만 업로드 가능합니다.")
    }
  }

  const handleUpload = async () => {
    if (!csvFile || !selectedSurvey) return

    setUploadLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", csvFile)

      const response = await fetch(`/api/admin/surveys/${selectedSurvey.id}/participants`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("업로드 실패")

      setUploadSuccess("참여자가 성공적으로 업로드되었습니다!")
      setCsvFile(null)
      fetchParticipants(selectedSurvey.id)

      setTimeout(() => setUploadSuccess(""), 3000)
    } catch (error) {
      console.error("CSV 업로드 오류:", error)
      setError("CSV 업로드에 실패했습니다.")
    } finally {
      setUploadLoading(false)
    }
  }

  // CSV 다운로드 함수들
  const downloadOverallStats = () => {
    if (!selectedSurvey) return

    const completedParticipants = participants.filter((p) => p.is_completed)
    const totalParticipants = participants.length
    const completionRate = totalParticipants > 0 ? (completedParticipants.length / totalParticipants) * 100 : 0

    // 전체 평균 점수 계산
    const totalScore = responses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
    const averageScore = completedParticipants.length > 0 ? totalScore / completedParticipants.length : 0

    const csvContent = [
      ["전체병원 통계"],
      ["설문지명", selectedSurvey.title],
      ["총 참여자수", totalParticipants.toString()],
      ["완료된 설문수", completedParticipants.length.toString()],
      ["완료율", `${completionRate.toFixed(1)}%`],
      ["전체 평균점수", `${averageScore.toFixed(1)}/5`],
      ["생성일", new Date(selectedSurvey.created_at).toLocaleDateString()],
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `전체병원통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadQuestionStats = () => {
    if (!selectedSurvey || questionStats.length === 0) return

    const csvContent = [
      ["전체병원 문항별통계"],
      ["문항", "응답수", "평균점수"],
      ...questionStats.map((stat) => [stat.questionText, stat.responseCount.toString(), stat.averageScore.toFixed(1)]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `전체병원문항별통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadHospitalStats = () => {
    if (!selectedSurvey || participants.length === 0) return

    // 병원별 통계 계산
    const hospitalStats = participants.reduce(
      (acc, participant) => {
        const hospital = participant.hospital_name
        if (!acc[hospital]) {
          acc[hospital] = {
            total: 0,
            completed: 0,
            totalScore: 0,
          }
        }

        acc[hospital].total++
        if (participant.is_completed) {
          acc[hospital].completed++

          // 해당 참여자의 응답 점수 합계
          const participantResponses = responses.filter(
            (r) =>
              r.survey_participants?.participant_name === participant.participant_name &&
              r.survey_participants?.hospital_name === hospital,
          )
          const participantScore = participantResponses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
          acc[hospital].totalScore += participantScore
        }

        return acc
      },
      {} as Record<string, { total: number; completed: number; totalScore: number }>,
    )

    const csvContent = [
      ["병원별통계"],
      ["병원명", "총대상자", "응답완료", "완료율", "평균점수"],
      ...Object.entries(hospitalStats).map(([hospital, stats]) => [
        hospital,
        stats.total.toString(),
        stats.completed.toString(),
        `${stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}%`,
        `${stats.completed > 0 ? (stats.totalScore / stats.completed).toFixed(1) : 0}/5`,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `병원별통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadHospitalDetailedStats = () => {
    if (!selectedSurvey || responses.length === 0) return

    // 병원별 문항별 상세 통계
    const detailedStats: Record<string, Record<string, { count: number; totalScore: number }>> = {}

    responses.forEach((response) => {
      const hospital = response.survey_participants?.hospital_name || "알 수 없음"
      const questionText =
        questionStats.find((q) => q.questionId === response.question_id)?.questionText || `문항 ${response.question_id}`

      if (!detailedStats[hospital]) {
        detailedStats[hospital] = {}
      }

      if (!detailedStats[hospital][questionText]) {
        detailedStats[hospital][questionText] = { count: 0, totalScore: 0 }
      }

      detailedStats[hospital][questionText].count++
      detailedStats[hospital][questionText].totalScore += response.answer_value || 0
    })

    const csvRows = [["병원별 문항별 상세통계"], ["병원명", "문항", "응답수", "평균점수"]]

    Object.entries(detailedStats).forEach(([hospital, questions]) => {
      Object.entries(questions).forEach(([question, stats]) => {
        csvRows.push([hospital, question, stats.count.toString(), (stats.totalScore / stats.count).toFixed(1)])
      })
    })

    const csvContent = csvRows.map((row) => row.join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `병원별문항별상세통계_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const downloadParticipantsExcel = () => {
    if (!selectedSurvey || participants.length === 0) return

    const csvContent = [
      ["이름", "휴대폰번호", "병원이름", "토큰이포함된설문지주소"],
      ...participants.map((participant) => [
        participant.participant_name,
        participant.phone_number,
        participant.hospital_name,
        `${window.location.origin}/${participant.token}`,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `참여자연락처_${selectedSurvey.title}_${new Date().toISOString().split("T")[0]}.csv`
    link.click()
  }

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setUploadSuccess("링크가 클립보드에 복사되었습니다!")
      setTimeout(() => setUploadSuccess(""), 2000)
    })
  }

  // 필터링된 참여자 목록
  const filteredParticipants = participants.filter((participant) => {
    const matchesHospital =
      hospitalFilter === "" || participant.hospital_name.toLowerCase().includes(hospitalFilter.toLowerCase())
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && participant.is_completed) ||
      (statusFilter === "incomplete" && !participant.is_completed)
    return matchesHospital && matchesStatus
  })

  // 병원별 통계 계산 (검색 필터 적용)
  const hospitalStats = participants.reduce(
    (acc, participant) => {
      const hospital = participant.hospital_name
      if (!acc[hospital]) {
        acc[hospital] = {
          total: 0,
          completed: 0,
          totalScore: 0,
        }
      }

      acc[hospital].total++
      if (participant.is_completed) {
        acc[hospital].completed++

        // 해당 참여자의 응답 점수 합계
        const participantResponses = responses.filter(
          (r) =>
            r.survey_participants?.participant_name === participant.participant_name &&
            r.survey_participants?.hospital_name === hospital,
        )
        const participantScore = participantResponses.reduce((sum, r) => sum + (r.answer_value || 0), 0)
        acc[hospital].totalScore += participantScore
      }

      return acc
    },
    {} as Record<string, { total: number; completed: number; totalScore: number }>,
  )

  // 검색된 병원 목록
  const filteredHospitals = Object.entries(hospitalStats).filter(([hospital]) =>
    hospital.toLowerCase().includes(hospitalSearchFilter.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {!isAuthenticated && (
          <Card className="max-w-md mx-auto mt-20">
            <CardHeader>
              <CardTitle className="text-center">관리자 로그인</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="관리자 비밀번호"
                  className="w-full"
                />
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full">
                  로그인
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리</h1>
              <Button onClick={() => setIsAuthenticated(false)} variant="outline">
                로그아웃
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="create" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {isEditMode ? "설문지 수정" : "설문지 생성"}
                  {newSurveyQuestions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-800">
                      {newSurveyQuestions.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="manage" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  설문지 관리
                </TabsTrigger>
                <TabsTrigger value="participants" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  대상자 관리
                </TabsTrigger>
                <TabsTrigger value="statistics" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  통계
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {isEditMode ? "설문지 수정" : "새 설문지 생성"}
                      {isEditMode && (
                        <Button onClick={cancelEdit} variant="outline" size="sm">
                          수정 취소
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateSurvey} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">설문지 제목</label>
                          <Input
                            value={newSurveyTitle}
                            onChange={(e) => setNewSurveyTitle(e.target.value)}
                            placeholder="설문지 제목을 입력하세요"
                            className="w-full"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">설문지 설명</label>
                          <Textarea
                            value={newSurveyDescription}
                            onChange={(e) => setNewSurveyDescription(e.target.value)}
                            placeholder="설문지 설명을 입력하세요"
                            className="w-full"
                            rows={3}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">설문 문항</h3>
                        {newSurveyQuestions.map((question, index) => (
                          <Card key={index} className="p-4">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium">문항 {index + 1}</label>
                                {newSurveyQuestions.length > 1 && (
                                  <Button
                                    onClick={() => removeQuestion(index)}
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <Input
                                value={question.question}
                                onChange={(e) => updateQuestion(index, e.target.value)}
                                placeholder={`문항 ${index + 1}을 입력하세요`}
                                className="w-full"
                              />

                              <div className="space-y-2">
                                <label className="block text-sm font-medium">답변 옵션</label>
                                {question.answers.map((answer, answerIndex) => (
                                  <div key={answerIndex} className="flex items-center gap-2">
                                    <Input
                                      value={answer.text}
                                      onChange={(e) => updateAnswer(index, answerIndex, "text", e.target.value)}
                                      placeholder={`답변 ${answerIndex + 1}`}
                                      className="flex-1"
                                    />
                                    <Input
                                      type="number"
                                      value={answer.score.toString()}
                                      onChange={(e) => updateAnswer(index, answerIndex, "score", e.target.value)}
                                      placeholder="점수"
                                      className="w-20"
                                      min="1"
                                      max="10"
                                    />
                                    {question.answers.length > 1 && (
                                      <Button
                                        onClick={() => removeAnswer(index, answerIndex)}
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                <Button onClick={() => addAnswer(index)} variant="outline" size="sm" className="w-full">
                                  답변 옵션 추가
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}

                        <Button onClick={addQuestion} variant="outline" className="w-full bg-transparent">
                          문항 추가
                        </Button>
                      </div>

                      {error && (
                        <Alert variant="destructive">
                          <AlertDescription>{error}</AlertDescription>
                        </Alert>
                      )}

                      {uploadSuccess && (
                        <Alert className="border-green-200 bg-green-50">
                          <AlertDescription className="text-green-800">{uploadSuccess}</AlertDescription>
                        </Alert>
                      )}

                      <Button type="submit" className="w-full" disabled={createLoading}>
                        {createLoading ? "처리 중..." : isEditMode ? "설문지 수정" : "설문지 생성"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="manage" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>설문지 관리</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {surveys.map((survey) => (
                        <Card
                          key={survey.id}
                          className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selectedSurvey?.id === survey.id ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-gray-50"
                          }`}
                          onClick={() => setSelectedSurvey(survey)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div>
                                <h3 className="font-semibold text-lg truncate">{survey.title}</h3>
                                <p className="text-sm text-gray-600 line-clamp-2">{survey.description}</p>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">참여자: {survey.participantCount || 0}명</span>
                                <Badge variant={survey.is_active ? "default" : "secondary"}>
                                  {survey.is_active ? "활성" : "비활성"}
                                </Badge>
                              </div>

                              <div className="text-xs text-gray-400">
                                생성일: {new Date(survey.created_at).toLocaleDateString()}
                              </div>

                              <div className="flex gap-2 pt-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditSurvey(survey)
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  수정
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSurveyToDelete(survey)
                                    setShowDeleteConfirm(true)
                                  }}
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {surveys.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        생성된 설문지가 없습니다. 새 설문지를 생성해보세요.
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 삭제 확인 모달 */}
                {showDeleteConfirm && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <Card className="w-full max-w-md mx-4">
                      <CardHeader>
                        <CardTitle className="text-red-600">설문지 삭제</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p>정말로 "{surveyToDelete?.title}" 설문지를 삭제하시겠습니까?</p>
                        <p className="text-sm text-red-600">이 작업은 되돌릴 수 없습니다.</p>
                        <Input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="관리자 비밀번호 확인"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowDeleteConfirm(false)
                              setSurveyToDelete(null)
                              setDeletePassword("")
                            }}
                            variant="outline"
                            className="flex-1"
                          >
                            취소
                          </Button>
                          <Button onClick={deleteSurvey} variant="destructive" className="flex-1">
                            삭제
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="participants" className="space-y-6">
                {!selectedSurvey ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">설문지를 선택해주세요</h3>
                      <p className="text-gray-500 mb-4">대상자를 관리하려면 먼저 설문지를 선택해야 합니다.</p>
                      <Button onClick={() => setActiveTab("manage")}>설문지 관리로 이동</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>대상자 관리 - {selectedSurvey.title}</CardTitle>
                          <Button
                            onClick={() => {
                              setSelectedSurvey(null)
                              setActiveTab("manage")
                            }}
                            variant="outline"
                            size="sm"
                          >
                            다른 설문지 선택
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* 통계 카드 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-blue-600">{participants.length}</div>
                              <div className="text-sm text-blue-600">총 대상자</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-green-600">
                                {participants.filter((p) => p.is_completed).length}
                              </div>
                              <div className="text-sm text-green-600">완료</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-orange-50 border-orange-200">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-orange-600">
                                {participants.filter((p) => !p.is_completed).length}
                              </div>
                              <div className="text-sm text-orange-600">미완료</div>
                            </CardContent>
                          </Card>
                          <Card className="bg-purple-50 border-purple-200">
                            <CardContent className="p-4 text-center">
                              <div className="text-2xl font-bold text-purple-600">
                                {participants.length > 0
                                  ? (
                                      (participants.filter((p) => p.is_completed).length / participants.length) *
                                      100
                                    ).toFixed(1)
                                  : 0}
                                %
                              </div>
                              <div className="text-sm text-purple-600">완료율</div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* CSV 업로드 */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">참여자 일괄 업로드</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-medium mb-2">CSV 파일 형식</h4>
                              <p className="text-sm text-gray-600 mb-2">각 줄에 다음 형식으로 입력해주세요:</p>
                              <code className="text-sm bg-white p-2 rounded border block">
                                병원이름|참여자이름|휴대폰번호
                              </code>
                              <p className="text-xs text-gray-500 mt-2">예: 서울병원|홍길동|010-1234-5678</p>
                            </div>

                            <div className="flex items-center gap-4">
                              <Input type="file" accept=".csv" onChange={handleFileSelect} className="flex-1" />
                              <Button onClick={handleUpload} disabled={!csvFile || uploadLoading}>
                                {uploadLoading ? "업로드 중..." : "업로드"}
                              </Button>
                            </div>

                            {csvFile && <p className="text-sm text-green-600">선택된 파일: {csvFile.name}</p>}
                          </CardContent>
                        </Card>

                        {/* 필터 */}
                        <div className="flex gap-4">
                          <Input
                            placeholder="병원명으로 검색"
                            value={hospitalFilter}
                            onChange={(e) => setHospitalFilter(e.target.value)}
                            className="flex-1"
                          />
                          <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 border rounded-md"
                          >
                            <option value="all">전체</option>
                            <option value="completed">완료</option>
                            <option value="incomplete">미완료</option>
                          </select>
                        </div>

                        {/* 대상자 목록 */}
                        <Card>
                          <CardHeader>
                            <CardTitle>대상자 목록 ({filteredParticipants.length}명)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>이름</TableHead>
                                  <TableHead>휴대폰번호</TableHead>
                                  <TableHead>병원이름</TableHead>
                                  <TableHead>상태</TableHead>
                                  <TableHead>생성일</TableHead>
                                  <TableHead>작업</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredParticipants.map((participant) => (
                                  <TableRow key={participant.id}>
                                    <TableCell className="font-medium">{participant.participant_name}</TableCell>
                                    <TableCell>{participant.phone_number}</TableCell>
                                    <TableCell>{participant.hospital_name}</TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={participant.is_completed ? "default" : "secondary"}
                                        className={
                                          participant.is_completed
                                            ? "bg-green-100 text-green-800"
                                            : "bg-orange-100 text-orange-800"
                                        }
                                      >
                                        {participant.is_completed ? "완료" : "미완료"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{new Date(participant.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                      <Button
                                        onClick={() => copyToClipboard(participant.token)}
                                        variant="outline"
                                        size="sm"
                                      >
                                        링크 복사
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>

                            {filteredParticipants.length === 0 && (
                              <div className="text-center py-8 text-gray-500">
                                {participants.length === 0
                                  ? "등록된 대상자가 없습니다."
                                  : "검색 조건에 맞는 대상자가 없습니다."}
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* 응답 분석 */}
                        {responses.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle>응답 분석</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <Card className="bg-blue-50 border-blue-200">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-xl font-bold text-blue-600">{responses.length}</div>
                                    <div className="text-sm text-blue-600">총 응답 수</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-green-50 border-green-200">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-xl font-bold text-green-600">
                                      {responses.length > 0
                                        ? (
                                            responses.reduce((sum, r) => sum + (r.answer_value || 0), 0) /
                                            responses.length
                                          ).toFixed(1)
                                        : 0}
                                    </div>
                                    <div className="text-sm text-green-600">평균 점수</div>
                                  </CardContent>
                                </Card>
                                <Card className="bg-purple-50 border-purple-200">
                                  <CardContent className="p-4 text-center">
                                    <div className="text-xl font-bold text-purple-600">
                                      {new Set(responses.map((r) => r.survey_participants?.hospital_name)).size}
                                    </div>
                                    <div className="text-sm text-purple-600">참여 병원 수</div>
                                  </CardContent>
                                </Card>
                              </div>

                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>참여자명</TableHead>
                                    <TableHead>병원이름</TableHead>
                                    <TableHead>응답 수</TableHead>
                                    <TableHead>평균 점수</TableHead>
                                    <TableHead>응답일시</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.entries(
                                    responses.reduce(
                                      (acc, response) => {
                                        const key = `${response.survey_participants?.participant_name}-${response.survey_participants?.hospital_name}`
                                        if (!acc[key]) {
                                          acc[key] = {
                                            name: response.survey_participants?.participant_name || "",
                                            hospital: response.survey_participants?.hospital_name || "",
                                            responses: [],
                                            date: response.created_at,
                                          }
                                        }
                                        acc[key].responses.push(response.answer_value || 0)
                                        return acc
                                      },
                                      {} as Record<string, any>,
                                    ),
                                  ).map(([key, data]) => (
                                    <TableRow key={key}>
                                      <TableCell className="font-medium">{data.name}</TableCell>
                                      <TableCell>{data.hospital}</TableCell>
                                      <TableCell>{data.responses.length}</TableCell>
                                      <TableCell>
                                        {(
                                          data.responses.reduce((sum: number, val: number) => sum + val, 0) /
                                          data.responses.length
                                        ).toFixed(1)}
                                      </TableCell>
                                      <TableCell>{new Date(data.date).toLocaleString()}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </CardContent>
                          </Card>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="statistics" className="space-y-6">
                {!selectedSurvey ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-semibold text-gray-600 mb-2">설문지를 선택해주세요</h3>
                      <p className="text-gray-500 mb-4">통계를 확인하려면 먼저 설문지를 선택해야 합니다.</p>
                      <Button onClick={() => setActiveTab("manage")}>설문지 관리로 이동</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>통계 - {selectedSurvey.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* 전체 병원 합계 */}
                        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                          <CardHeader>
                            <CardTitle className="text-blue-800">전체 병원 합계</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                  {new Set(participants.map((p) => p.hospital_name)).size}
                                </div>
                                <div className="text-sm text-blue-600">참여 병원 수</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-green-600">{participants.length}</div>
                                <div className="text-sm text-green-600">총 대상자</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-purple-600">
                                  {participants.filter((p) => p.is_completed).length}
                                </div>
                                <div className="text-sm text-purple-600">응답 완료</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-orange-600">
                                  {participants.length > 0
                                    ? (
                                        (participants.filter((p) => p.is_completed).length / participants.length) *
                                        100
                                      ).toFixed(1)
                                    : 0}
                                  %
                                </div>
                                <div className="text-sm text-orange-600">완료율</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-bold text-red-600">
                                  {responses.length > 0
                                    ? (
                                        responses.reduce((sum, r) => sum + (r.answer_value || 0), 0) / responses.length
                                      ).toFixed(1)
                                    : 0}
                                  /5
                                </div>
                                <div className="text-sm text-red-600">평균 점수</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* 병원별 통계 */}
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle>병원별 통계</CardTitle>
                              <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="병원명 검색"
                                  value={hospitalSearchFilter}
                                  onChange={(e) => setHospitalSearchFilter(e.target.value)}
                                  className="w-64"
                                />
                                {hospitalSearchFilter && (
                                  <Button onClick={() => setHospitalSearchFilter("")} variant="outline" size="sm">
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            {hospitalSearchFilter ? (
                              <div className="space-y-4">
                                <p className="text-sm text-gray-600">검색 결과: {filteredHospitals.length}개 병원</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {filteredHospitals.map(([hospital, stats]) => (
                                    <Card key={hospital} className="border-l-4 border-l-blue-500">
                                      <CardContent className="p-4">
                                        <h4 className="font-semibold text-lg mb-3 truncate">{hospital}</h4>
                                        <div className="space-y-2">
                                          <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">총 대상자:</span>
                                            <span className="font-medium">{stats.total}명</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">응답 완료:</span>
                                            <span className="font-medium text-green-600">{stats.completed}명</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">완료율:</span>
                                            <span className="font-medium">
                                              {stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0}
                                              %
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">평균 점수:</span>
                                            <span className="font-medium text-blue-600">
                                              {stats.completed > 0
                                                ? (stats.totalScore / stats.completed).toFixed(1)
                                                : 0}
                                              /5
                                            </span>
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <p>병원별 통계를 보려면 위의 검색창에서 병원명을 검색해 주세요.</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* 문항별 통계 */}
                        <Card>
                          <CardHeader>
                            <CardTitle>
                              문항별 통계
                              {hospitalSearchFilter && (
                                <span className="text-sm font-normal text-gray-600 ml-2">
                                  ({hospitalSearchFilter} 병원)
                                </span>
                              )}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {questionStats.length > 0 ? (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>문항</TableHead>
                                    <TableHead className="text-center">응답 수</TableHead>
                                    <TableHead className="text-center">평균 점수</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {questionStats.map((stat) => (
                                    <TableRow key={stat.questionId}>
                                      <TableCell className="font-medium max-w-md">
                                        {stat.questionText || `문항 ${stat.questionId}`}
                                      </TableCell>
                                      <TableCell className="text-center">{stat.responseCount}명</TableCell>
                                      <TableCell className="text-center">
                                        <span
                                          className={`font-semibold ${
                                            stat.averageScore >= 4
                                              ? "text-green-600"
                                              : stat.averageScore >= 3
                                                ? "text-yellow-600"
                                                : "text-red-600"
                                          }`}
                                        >
                                          {typeof stat.averageScore === "number" ? stat.averageScore.toFixed(1) : "0.0"}
                                          /5
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <div className="text-center py-8 text-gray-500">문항별 통계 데이터가 없습니다.</div>
                            )}
                          </CardContent>
                        </Card>

                        {/* 데이터 내보내기 */}
                        <Card>
                          <CardHeader>
                            <CardTitle>데이터 내보내기</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              <Button
                                onClick={downloadOverallStats}
                                variant="outline"
                                className="h-auto p-4 bg-transparent"
                              >
                                <div className="text-center">
                                  <Download className="h-6 w-6 mx-auto mb-2" />
                                  <div className="font-medium">전체병원 통계</div>
                                  <div className="text-xs text-gray-500">CSV 다운로드</div>
                                </div>
                              </Button>
                              <Button
                                onClick={downloadQuestionStats}
                                variant="outline"
                                className="h-auto p-4 bg-transparent"
                              >
                                <div className="text-center">
                                  <Download className="h-6 w-6 mx-auto mb-2" />
                                  <div className="font-medium">전체병원 문항별통계</div>
                                  <div className="text-xs text-gray-500">CSV 다운로드</div>
                                </div>
                              </Button>
                              <Button
                                onClick={downloadHospitalStats}
                                variant="outline"
                                className="h-auto p-4 bg-transparent"
                              >
                                <div className="text-center">
                                  <Download className="h-6 w-6 mx-auto mb-2" />
                                  <div className="font-medium">병원별 통계</div>
                                  <div className="text-xs text-gray-500">CSV 다운로드</div>
                                </div>
                              </Button>
                              <Button
                                onClick={downloadHospitalDetailedStats}
                                variant="outline"
                                className="h-auto p-4 bg-transparent"
                              >
                                <div className="text-center">
                                  <Download className="h-6 w-6 mx-auto mb-2" />
                                  <div className="font-medium">병원별 문항별 상세통계</div>
                                  <div className="text-xs text-gray-500">CSV 다운로드</div>
                                </div>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* 전역 성공/에러 메시지 */}
            {error && (
              <Alert variant="destructive" className="fixed bottom-4 right-4 w-auto max-w-md z-50">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {uploadSuccess && (
              <Alert className="fixed bottom-4 right-4 w-auto max-w-md z-50 border-green-200 bg-green-50">
                <AlertDescription className="text-green-800">{uploadSuccess}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
