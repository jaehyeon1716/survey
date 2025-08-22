"use client"

import { CardDescription } from "@/components/ui/card"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, FileText, Eye } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

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
    question_number: number
  }>
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
}

interface SurveyResponse {
  id: number
  participant_token: string
  question_id: number
  response_value: number
  created_at: string
  survey_participants?: {
    hospital_name: string
    participant_name: string
    phone_number: string
  }
  total_score: number
  max_possible_score: number
}

interface QuestionStat {
  id: number
  questionNumber: number
  questionText: string
  totalResponses: number
  averageScore: string
  maxScore: number
}

const ADMIN_PASSWORD = "hospital2024"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [surveys, setSurveys] = useState<any[]>([])
  const [participants, setParticipants] = useState<any[]>([])
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadSuccess, setUploadSuccess] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

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

  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [hospitalFilter, setHospitalFilter] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([])

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editQuestions, setEditQuestions] = useState<string[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null)
  const [showTokens, setShowTokens] = useState(false)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

  const downloadParticipantsExcel = () => {
    if (!selectedSurvey || filteredParticipants.length === 0) {
      alert("다운로드할 참여자 데이터가 없습니다.")
      return
    }

    const excelData = filteredParticipants.map((participant) => ({
      참여자명: participant.participant_name,
      휴대폰번호: participant.phone_number,
      병원명: participant.hospital_name,
      설문링크: `${window.location.origin}/${participant.token}`,
    }))

    const headers = Object.keys(excelData[0])
    const csvContent = excelData
      .map((row) =>
        headers
          .map((header) => {
            const value = row[header as keyof typeof row]
            return typeof value === "string" && (value.includes(",") || value.includes('"'))
              ? `"${value.replace(/"/g, '""')}"`
              : value
          })
          .join(","),
      )
      .join("\n")

    const BOM = "\uFEFF"
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })

    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${selectedSurvey.title}_참여자연락처_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadGuide = () => {
    const guideContent = `병원 만족도 조사 시스템 사용 가이드

1. 설문지 생성
   - 제목과 설명을 입력합니다
   - 질문을 추가하고 답변 옵션을 설정합니다
   - 각 답변 옵션에 점수를 부여할 수 있습니다

2. 설문지 관리
   - 생성된 설문지 목록을 확인할 수 있습니다
   - 각 설문지의 참여자 수와 상태를 모니터링합니다

3. 응답 분석
   - 설문 응답 결과를 실시간으로 확인할 수 있습니다
   - 통계 데이터를 통해 만족도를 분석합니다`

    const blob = new Blob([guideContent], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "병원만족도조사_사용가이드.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === "hospital2024") {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("비밀번호가 올바르지 않습니다.")
    }
  }

  const fetchSurveys = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/surveys")
      const data = await response.json()

      if (response.ok) {
        setSurveys(data.surveys || [])
      } else {
        setError(data.error || "설문지 조회 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchParticipants = async (surveyId?: number) => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", surveyId || selectedSurvey?.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setParticipants(data || [])
    } catch (err) {
      console.error("참여자 데이터 조회 오류:", err)
    }
  }

  const fetchResponses = async (surveyId?: number) => {
    if (!supabase) return

    setLoading(true)
    try {
      let query = supabase
        .from("survey_response_summaries")
        .select(`
          *,
          survey_participants (
            hospital_name,
            participant_name,
            phone_number
          )
        `)
        .order("created_at", { ascending: false })

      if (surveyId) {
        query = query.eq("survey_id", surveyId)
      }

      const { data, error } = await query

      if (error) throw error
      setResponses(data || [])

      if (surveyId) {
        await fetchQuestionStats(surveyId)
      }
    } catch (err) {
      setError("설문 응답 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionStats = async (surveyId: number, hospitalName?: string) => {
    if (!supabase) return

    try {
      const { data: questionsData, error: questionsError } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", surveyId)
        .order("question_number", { ascending: true })

      if (questionsError || !questionsData) return

      let responsesQuery = supabase
        .from("survey_responses")
        .select(`
          question_id,
          response_value,
          participant_token,
          survey_questions (
            question_text,
            question_number
          ),
          survey_participants!inner (
            hospital_name
          )
        `)
        .in(
          "question_id",
          questionsData.map((q) => q.id),
        )

      if (hospitalName && hospitalName.trim() !== "") {
        responsesQuery = responsesQuery.ilike("survey_participants.hospital_name", `%${hospitalName.trim()}%`)
      }

      const { data: responsesData, error: responsesError } = await responsesQuery

      if (responsesError || !responsesData) return

      const questionStatsMap = questionsData.map((question) => {
        const questionResponses = responsesData.filter((r: any) => r.question_id === question.id)
        const totalResponses = questionResponses.length
        const averageScore =
          totalResponses > 0 ? questionResponses.reduce((sum, r: any) => sum + r.response_value, 0) / totalResponses : 0

        return {
          id: question.id,
          questionNumber: question.question_number,
          questionText: question.question_text,
          totalResponses,
          averageScore: averageScore.toFixed(1),
          maxScore: 5,
        }
      })

      setQuestionStats(questionStatsMap)
    } catch (err) {
      console.error("문항별 통계 조회 오류:", err)
    }
  }

  const handleCreateSurvey = async () => {
    if (!newSurveyTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = newSurveyQuestions.filter((q) => q.question.trim() !== "")
    if (validQuestions.length === 0) {
      setError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setCreateLoading(true)
    setError("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newSurveyTitle.trim(),
          description: newSurveyDescription.trim(),
          questions: validQuestions.map((q) => ({
            question: q.question.trim(),
            answers: q.answers.filter((a) => a.text.trim() !== ""),
          })),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 생성되었습니다.")
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
        fetchSurveys()
      } else {
        setError(data.error || "설문지 생성 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 생성 중 오류가 발생했습니다.")
    } finally {
      setCreateLoading(false)
    }
  }

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
      const updated = newSurveyQuestions.filter((_, i) => i !== index)
      setNewSurveyQuestions(updated)
    }
  }

  const updateQuestion = (index: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[index].question = value
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

  const updateAnswer = (
    questionIndex: number,
    answerIndex: number,
    field: "text" | "score",
    value: string | number,
  ) => {
    const updated = [...newSurveyQuestions]
    if (field === "text") {
      updated[questionIndex].answers[answerIndex].text = value as string
    } else {
      updated[questionIndex].answers[answerIndex].score = Number(value)
    }
    setNewSurveyQuestions(updated)
  }

  const createSurvey = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setUploadSuccess("")

    try {
      const response = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: newSurveyTitle,
          description: newSurveyDescription,
          questions: newSurveyQuestions,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 생성되었습니다!")
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
        fetchSurveys()
      } else {
        setError(data.error || "설문지 생성 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 생성 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const addQuestionOld = () => {
    setNewSurveyQuestions([
      ...newSurveyQuestions,
      { question: "", answers: ["매우 그렇다", "그렇다", "보통이다", "그렇지 않다", "전혀 그렇지 않다"] },
    ])
  }

  const removeQuestionOld = (index: number) => {
    if (newSurveyQuestions.length > 1) {
      setNewSurveyQuestions(newSurveyQuestions.filter((_, i) => i !== index))
    }
  }

  const updateQuestionOld = (index: number, field: "question" | "answers", value: string | string[]) => {
    const updated = [...newSurveyQuestions]
    if (field === "question") {
      updated[index].question = value as string
    } else {
      updated[index].answers = value as string[]
    }
    setNewSurveyQuestions(updated)
  }

  const addAnswerOld = (questionIndex: number) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers.push("")
    setNewSurveyQuestions(updated)
  }

  const removeAnswerOld = (questionIndex: number, answerIndex: number) => {
    const updated = [...newSurveyQuestions]
    if (updated[questionIndex].answers.length > 1) {
      updated[questionIndex].answers = updated[questionIndex].answers.filter((_, i) => i !== answerIndex)
      setNewSurveyQuestions(updated)
    }
  }

  const updateAnswerOld = (questionIndex: number, answerIndex: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[questionIndex].answers[answerIndex] = value
    setNewSurveyQuestions(updated)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === "text/csv") {
      setSelectedFile(file)
      setError("")
    } else {
      setError("CSV 파일만 업로드 가능합니다.")
      setSelectedFile(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("파일을 선택해주세요.")
      return
    }

    if (!selectedSurvey) {
      setError("설문지를 선택해주세요.")
      return
    }

    setLoading(true)
    setError("")
    setUploadSuccess("")

    try {
      const formData = new FormData()
      formData.append("csvFile", selectedFile)

      const response = await fetch(`/api/admin/surveys/${selectedSurvey.id}/participants`, {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadSuccess(result.message)
        setSelectedFile(null)
        const fileInput = document.getElementById("csvFile") as HTMLInputElement
        if (fileInput) fileInput.value = ""
        fetchParticipants(selectedSurvey.id)
      } else {
        setError(result.error || "업로드 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("업로드 중 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (token: string) => {
    const surveyUrl = `${window.location.origin}/${token}`
    try {
      await navigator.clipboard.writeText(surveyUrl)
      alert("설문 링크가 클립보드에 복사되었습니다!")
    } catch (err) {
      alert("링크 복사에 실패했습니다.")
    }
  }

  const downloadCSV = () => {
    if (responses.length === 0) {
      alert("다운로드할 데이터가 없습니다.")
      return
    }

    const headers = ["병원명", "참여자명", "휴대폰번호", "총점", "최대점수", "완료일시"]

    const csvData = responses.map((response) => [
      response.survey_participants?.hospital_name || "",
      response.survey_participants?.participant_name || "",
      response.survey_participants?.phone_number || "",
      response.total_score || "",
      response.max_possible_score || "",
      new Date(response.created_at).toLocaleString("ko-KR"),
    ])

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `설문조사_결과_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const openDetailModal = (response: SurveyResponse) => {
    setSelectedResponse(response)
    setShowDetailModal(true)
  }

  const handleEditSurvey = (survey: Survey) => {
    setEditingSurvey(survey)
    setEditTitle(survey.title)
    setEditDescription(survey.description || "")
    setEditQuestions(survey.survey_questions?.map((q) => q.question_text) || [""])
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      setError("설문지 제목을 입력해주세요.")
      return
    }

    const validQuestions = editQuestions.filter((q) => q.trim() !== "")
    if (validQuestions.length === 0) {
      setError("최소 1개의 문항을 입력해주세요.")
      return
    }

    setEditLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/surveys/${editingSurvey?.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          questions: validQuestions,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 수정되었습니다.")
        setShowEditModal(false)
        setEditingSurvey(null)
        fetchSurveys()
        if (selectedSurvey?.id === editingSurvey?.id) {
          setSelectedSurvey(null)
        }
      } else {
        setError(data.error || "설문지 수정 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 수정 중 오류가 발생했습니다.")
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteConfirm = (survey: Survey) => {
    setSurveyToDelete(survey)
    setShowDeleteConfirm(true)
  }

  const handleDeleteSurvey = async () => {
    if (!surveyToDelete) return

    if (deletePassword !== ADMIN_PASSWORD) {
      setError("비밀번호가 올바르지 않습니다.")
      return
    }

    setDeleteLoading(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/surveys/${surveyToDelete.id}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 삭제되었습니다.")
        setShowDeleteConfirm(false)
        setSurveyToDelete(null)
        setDeletePassword("")
        fetchSurveys()
        if (selectedSurvey?.id === surveyToDelete.id) {
          setSelectedSurvey(null)
        }
      } else {
        setError(data.error || "설문지 삭제 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("설문지 삭제 중 오류가 발생했습니다.")
    } finally {
      setDeleteLoading(false)
    }
  }

  const addEditQuestion = () => {
    setEditQuestions([...editQuestions, ""])
  }

  const removeEditQuestion = (index: number) => {
    if (editQuestions.length > 1) {
      setEditQuestions(editQuestions.filter((_, i) => i !== index))
    }
  }

  const updateEditQuestion = (index: number, value: string) => {
    const updated = [...editQuestions]
    updated[index] = value
    setEditQuestions(updated)
  }

  const filterParticipants = useCallback(() => {
    let filtered = participants

    if (hospitalFilter.trim()) {
      filtered = filtered.filter((p) => p.hospital_name.toLowerCase().includes(hospitalFilter.toLowerCase()))
    }

    if (statusFilter !== "all") {
      const isCompleted = statusFilter === "completed"
      filtered = filtered.filter((p) => p.is_completed === isCompleted)
    }

    setFilteredParticipants(filtered)
  }, [participants, hospitalFilter, statusFilter])

  const downloadStatsExcel = async () => {
    if (!selectedSurvey || responses.length === 0) {
      alert("다운로드할 통계 데이터가 없습니다.")
      return
    }

    const hospitalQuestionStats: Record<string, Record<number, any>> = {}

    try {
      if (supabase) {
        const { data: detailedResponses, error } = await supabase
          .from("survey_responses")
          .select(`
            question_id,
            response_value,
            survey_questions (
              question_text,
              question_number
            ),
            survey_participants!inner (
              hospital_name
            )
          `)
          .in(
            "question_id",
            questionStats.map((q) => q.id),
          )

        if (!error && detailedResponses) {
          detailedResponses.forEach((response: any) => {
            const hospital = response.survey_participants?.hospital_name || "알 수 없음"
            const questionId = response.question_id
            const questionNumber = response.survey_questions?.question_number || 0
            const questionText = response.survey_questions?.question_text || ""

            if (!hospitalQuestionStats[hospital]) {
              hospitalQuestionStats[hospital] = {}
            }

            if (!hospitalQuestionStats[hospital][questionId]) {
              hospitalQuestionStats[hospital][questionId] = {
                questionNumber,
                questionText,
                responses: [],
                total: 0,
                count: 0,
              }
            }

            hospitalQuestionStats[hospital][questionId].responses.push(response.response_value)
            hospitalQuestionStats[hospital][questionId].total += response.response_value
            hospitalQuestionStats[hospital][questionId].count += 1
          })
        }
      }
    } catch (err) {
      console.error("병원별 문항별 통계 조회 오류:", err)
    }

    const basicStats = [
      ["통계 항목", "값"],
      ["설문지 제목", selectedSurvey.title],
      ["총 참여자 수", participants.length.toString()],
      ["완료된 설문 수", responses.length.toString()],
      ["완료율", `${participants.length > 0 ? Math.round((responses.length / participants.length) * 100) : 0}%`],
      [
        "전체 평균 점수",
        responses.length > 0
          ? `${(responses.reduce((sum, r) => sum + (r.total_score || 0), 0) / responses.length).toFixed(1)}/${responses.length > 0 ? responses[0].max_possible_score : 0}`
          : "0",
      ],
      [""],
    ]

    const questionStatsData = [
      ["문항별 통계"],
      ["문항 번호", "문항 내용", "응답 수", "평균 점수"],
      ...questionStats.map((stat) => [
        stat.questionNumber.toString(),
        stat.questionText,
        stat.totalResponses.toString(),
        `${stat.averageScore}/${stat.maxScore}`,
      ]),
      [""],
    ]

    const hospitalStats = responses.reduce((acc: Record<string, any>, response) => {
      const hospital = response.survey_participants?.hospital_name || "알 수 없음"
      if (!acc[hospital]) {
        acc[hospital] = { count: 0, totalScore: 0, maxScore: response.max_possible_score }
      }
      acc[hospital].count += 1
      acc[hospital].totalScore += response.total_score || 0
      return acc
    }, {})

    const hospitalStatsData = [
      ["병원별 통계"],
      ["병원명", "응답 수", "평균 점수"],
      ...Object.entries(hospitalStats).map(([hospital, stats]: [string, any]) => [
        hospital,
        stats.count.toString(),
        `${(stats.totalScore / stats.count).toFixed(1)}/${stats.maxScore}`,
      ]),
      [""],
    ]

    const hospitalQuestionStatsData = [
      ["병원별 문항별 상세 통계"],
      ["병원명", "문항 번호", "문항 내용", "응답 수", "평균 점수"],
    ]

    Object.keys(hospitalQuestionStats)
      .sort()
      .forEach((hospital) => {
        const hospitalData = hospitalQuestionStats[hospital]

        const sortedQuestions = Object.values(hospitalData).sort(
          (a: any, b: any) => a.questionNumber - b.questionNumber,
        )

        sortedQuestions.forEach((questionData: any) => {
          const average = questionData.count > 0 ? (questionData.total / questionData.count).toFixed(1) : "0"
          hospitalQuestionStatsData.push([
            hospital,
            questionData.questionNumber.toString(),
            questionData.questionText,
            questionData.count.toString(),
            `${average}/5`,
          ])
        })

        const hospitalTotalStats = hospitalStats[hospital]
        if (hospitalTotalStats) {
          hospitalQuestionStatsData.push([
            hospital,
            "전체",
            "모든 문항 평균",
            hospitalTotalStats.count.toString(),
            `${(hospitalTotalStats.totalScore / hospitalTotalStats.count).toFixed(1)}/${hospitalTotalStats.maxScore}`,
          ])
        }

        hospitalQuestionStatsData.push(["", "", "", "", ""])
      })

    const allData = [...basicStats, ...questionStatsData, ...hospitalStatsData, ...hospitalQuestionStatsData]

    const csvContent = allData.map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${selectedSurvey.title}_통계_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchSurveys()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (selectedSurvey) {
      fetchParticipants(selectedSurvey.id)
      fetchResponses(selectedSurvey.id)
    }
  }, [selectedSurvey])

  useEffect(() => {
    if (selectedSurvey) {
      fetchQuestionStats(selectedSurvey.id, hospitalFilter)
    }
  }, [selectedSurvey, hospitalFilter])

  useEffect(() => {
    filterParticipants()
  }, [filterParticipants])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">관리자 로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password" className="text-lg font-medium">
                  비밀번호
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 h-12 text-lg"
                  placeholder="관리자 비밀번호를 입력하세요"
                  required
                />
              </div>
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700">
                로그인
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리 시스템</h1>
          <div className="flex items-center gap-4">
            <Button onClick={downloadGuide} variant="outline" className="flex items-center space-x-2 bg-transparent">
              <FileText className="w-4 h-4" />
              <span>사용 가이드</span>
            </Button>
            <Button onClick={() => setIsAuthenticated(false)} variant="outline">
              로그아웃
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {uploadSuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-700">{uploadSuccess}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">설문지 생성</TabsTrigger>
            <TabsTrigger value="manage">설문지 관리</TabsTrigger>
            <TabsTrigger value="analytics">응답 분석</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">새 설문지 생성</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={createSurvey} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="title" className="text-lg font-medium">
                        설문지 제목 *
                      </Label>
                      <Input
                        id="title"
                        value={newSurveyTitle}
                        onChange={(e) => setNewSurveyTitle(e.target.value)}
                        placeholder="예: 2024년 병원 만족도 조사"
                        className="mt-2 h-12 text-lg"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description" className="text-lg font-medium">
                        설명
                      </Label>
                      <Textarea
                        id="description"
                        value={newSurveyDescription}
                        onChange={(e) => setNewSurveyDescription(e.target.value)}
                        placeholder="설문지에 대한 간단한 설명을 입력하세요"
                        className="mt-2 min-h-[48px] text-lg"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-lg font-semibold">설문 문항 및 답변 옵션</Label>
                      <Button type="button" onClick={addQuestion} size="sm" className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        문항 추가
                      </Button>
                    </div>

                    {newSurveyQuestions.map((questionData, questionIndex) => (
                      <Card key={questionIndex} className="p-4 border-l-4 border-blue-500">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="font-medium">문항 {questionIndex + 1}</Label>
                            {newSurveyQuestions.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeQuestion(questionIndex)}
                                size="sm"
                                variant="destructive"
                                className="flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                삭제
                              </Button>
                            )}
                          </div>

                          <div>
                            <Label htmlFor={`question-${questionIndex}`}>질문 내용 *</Label>
                            <Textarea
                              id={`question-${questionIndex}`}
                              value={questionData.question}
                              onChange={(e) => updateQuestion(questionIndex, e.target.value)}
                              placeholder="예: 의료진의 친절도에 만족하십니까?"
                              rows={2}
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">답변 옵션</Label>
                              <Button
                                type="button"
                                onClick={() => addAnswer(questionIndex)}
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                답변 추가
                              </Button>
                            </div>

                            {questionData.answers.map((answer, answerIndex) => (
                              <div key={answerIndex} className="flex items-center gap-2">
                                <span className="text-sm font-medium w-8">{answerIndex + 1}.</span>
                                <Input
                                  value={answer.text}
                                  onChange={(e) => updateAnswer(questionIndex, answerIndex, "text", e.target.value)}
                                  placeholder={`답변 옵션 ${answerIndex + 1}`}
                                  className="flex-1"
                                />
                                <div className="flex items-center gap-1">
                                  <Label className="text-sm">점수:</Label>
                                  <Input
                                    type="number"
                                    value={answer.score}
                                    onChange={(e) => updateAnswer(questionIndex, answerIndex, "score", e.target.value)}
                                    className="w-16"
                                    min="1"
                                    max="10"
                                  />
                                </div>
                                {questionData.answers.length > 1 && (
                                  <Button
                                    type="button"
                                    onClick={() => removeAnswer(questionIndex, answerIndex)}
                                    size="sm"
                                    variant="ghost"
                                    className="p-1 h-8 w-8"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? "생성 중..." : "설문지 생성"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">설문지 관리</CardTitle>
              </CardHeader>
              <CardContent>
                {surveys.length === 0 ? (
                  <Alert>
                    <AlertDescription>생성된 설문지가 없습니다.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {surveys.map((survey) => (
                      <Card key={survey.id} className="p-4">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">{survey.title}</CardTitle>
                          <CardDescription>{survey.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                          <Badge variant="secondary">
                            참여자 수: {participants.filter((p) => p.survey_id === survey.id).length}
                          </Badge>
                          <Badge variant="outline">상태: {survey.is_active ? "활성" : "비활성"}</Badge>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedSurvey(survey)}>
                              <Eye className="w-4 h-4 mr-2" />
                              보기
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteConfirm(survey)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              삭제
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">응답 분석</CardTitle>
              </CardHeader>
              <CardContent>
                {participants.length === 0 ? (
                  <Alert>
                    <AlertDescription>참여자가 없습니다.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">총 참여자 수</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{participants.length}</div>
                        </CardContent>
                      </Card>

                      <Card className="p-4">
                        <CardHeader>
                          <CardTitle className="text-lg font-semibold">평균 만족도 점수</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">4.5 / 5</div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="p-4">
                      <CardHeader>
                        <CardTitle className="text-lg font-semibold">최근 응답</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {participants.slice(0, 5).map((participant) => (
                          <div key={participant.id} className="py-2 border-b last:border-b-0">
                            {participant.participant_name} - {participant.total_score} 점
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
