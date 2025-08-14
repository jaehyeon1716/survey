"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { supabase } from "@/lib/supabase/client"
import { Copy, Download, ExternalLink, Eye, Plus, Trash2, Edit } from "lucide-react"

const ADMIN_PASSWORD = "hospital2024" // 실제 운영시에는 환경변수로 관리

interface Survey {
  id: number
  title: string
  description: string
  is_active: boolean
  created_at: string
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
}

interface QuestionStat {
  id: number
  questionNumber: number
  questionText: string
  totalResponses: number
  averageScore: string
  maxScore: number
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [responses, setResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadSuccess, setUploadSuccess] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedResponse, setSelectedResponse] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const [newSurveyTitle, setNewSurveyTitle] = useState("")
  const [newSurveyDescription, setNewSurveyDescription] = useState("")
  const [newSurveyQuestions, setNewSurveyQuestions] = useState([""])
  const [createLoading, setCreateLoading] = useState(false)

  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([])
  const [hospitalFilter, setHospitalFilter] = useState("")

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
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

    setLoading(true)
    try {
      let query = supabase.from("survey_participants").select("*").order("created_at", { ascending: false })

      if (surveyId) {
        query = query.eq("survey_id", surveyId)
      }

      const { data, error } = await query

      if (error) throw error
      setParticipants(data || [])
    } catch (err) {
      setError("참여자 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
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
        const questionResponses = responsesData.filter((r) => r.question_id === question.id)
        const totalResponses = questionResponses.length
        const averageScore =
          totalResponses > 0 ? questionResponses.reduce((sum, r) => sum + r.response_value, 0) / totalResponses : 0

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

    const validQuestions = newSurveyQuestions.filter((q) => q.trim() !== "")
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
          questions: validQuestions,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setUploadSuccess("설문지가 성공적으로 생성되었습니다.")
        setNewSurveyTitle("")
        setNewSurveyDescription("")
        setNewSurveyQuestions([""])
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
    setNewSurveyQuestions([...newSurveyQuestions, ""])
  }

  const removeQuestion = (index: number) => {
    if (newSurveyQuestions.length > 1) {
      setNewSurveyQuestions(newSurveyQuestions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, value: string) => {
    const updated = [...newSurveyQuestions]
    updated[index] = value
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

    const csvData = responses.map((response: any) => [
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

  const openDetailModal = (response: any) => {
    setSelectedResponse(response)
    setShowDetailModal(true)
  }

  const handleEditSurvey = (survey: any) => {
    setEditingSurvey(survey)
    setEditTitle(survey.title)
    setEditDescription(survey.description || "")
    setEditQuestions(survey.survey_questions?.map((q: any) => q.question_text) || [""])
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

  const handleDeleteConfirm = (survey: any) => {
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

  const downloadStatsExcel = () => {
    if (!selectedSurvey || responses.length === 0) {
      alert("다운로드할 통계 데이터가 없습니다.")
      return
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
          ? `${(responses.reduce((sum: number, r: any) => sum + (r.total_score || 0), 0) / responses.length).toFixed(1)}/${responses.length > 0 ? responses[0].max_possible_score : 0}`
          : "0",
      ],
      [
        "만족도 비율",
        responses.length > 0 && responses[0].max_possible_score > 0
          ? `${((responses.reduce((sum: number, r: any) => sum + (r.total_score || 0), 0) / responses.length / responses[0].max_possible_score) * 100).toFixed(1)}%`
          : "0%",
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

    const hospitalStats = responses.reduce((acc: any, response: any) => {
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
    ]

    const allData = [...basicStats, ...questionStatsData, ...hospitalStatsData]

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">관리자 로그인</CardTitle>
            <CardDescription>병원 만족도 조사 관리 시스템</CardDescription>
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">병원 만족도 조사 관리 시스템</h1>
          <Button onClick={() => setIsAuthenticated(false)} variant="outline" className="text-lg px-6 py-2">
            로그아웃
          </Button>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-700 text-lg">{error}</AlertDescription>
          </Alert>
        )}

        {uploadSuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <AlertDescription className="text-green-700 text-lg">{uploadSuccess}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="surveys" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="surveys" className="text-lg">
              설문지 관리
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-lg">
              참여자 등록
            </TabsTrigger>
            <TabsTrigger value="participants" className="text-lg">
              참여자 목록
            </TabsTrigger>
            <TabsTrigger value="responses" className="text-lg">
              설문 결과
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-lg">
              통계
            </TabsTrigger>
          </TabsList>

          <TabsContent value="surveys">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">새 설문지 생성</CardTitle>
                  <CardDescription className="text-lg">
                    설문지 제목과 문항들을 입력하여 새로운 설문지를 만드세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="surveyTitle" className="text-lg font-medium">
                      설문지 제목 *
                    </Label>
                    <Input
                      id="surveyTitle"
                      value={newSurveyTitle}
                      onChange={(e) => setNewSurveyTitle(e.target.value)}
                      className="mt-2 h-12 text-lg"
                      placeholder="예: 2024년 병원 만족도 조사"
                    />
                  </div>

                  <div>
                    <Label htmlFor="surveyDescription" className="text-lg font-medium">
                      설문지 설명
                    </Label>
                    <Textarea
                      id="surveyDescription"
                      value={newSurveyDescription}
                      onChange={(e) => setNewSurveyDescription(e.target.value)}
                      className="mt-2 text-lg"
                      placeholder="설문지에 대한 간단한 설명을 입력하세요"
                      rows={3}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <Label className="text-lg font-medium">설문 문항 *</Label>
                      <Button onClick={addQuestion} size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-1" />
                        문항 추가
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {newSurveyQuestions.map((question, index) => (
                        <div key={index} className="flex gap-2">
                          <div className="flex-1">
                            <Input
                              value={question}
                              onChange={(e) => updateQuestion(index, e.target.value)}
                              placeholder={`문항 ${index + 1}을 입력하세요`}
                              className="h-12 text-lg"
                            />
                          </div>
                          {newSurveyQuestions.length > 1 && (
                            <Button onClick={() => removeQuestion(index)} size="sm" variant="outline">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateSurvey}
                    disabled={createLoading}
                    className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700"
                  >
                    {createLoading ? "생성 중..." : "설문지 생성"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">설문지 목록</CardTitle>
                  <CardDescription className="text-lg">생성된 설문지를 확인하고 관리하세요</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">
                      <p className="text-xl">데이터를 불러오는 중...</p>
                    </div>
                  ) : surveys.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xl text-gray-500">생성된 설문지가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {surveys.map((survey: any) => (
                        <div
                          key={survey.id}
                          className={`p-4 border rounded-lg transition-colors ${
                            selectedSurvey?.id === survey.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 cursor-pointer" onClick={() => setSelectedSurvey(survey)}>
                              <h3 className="text-lg font-semibold">{survey.title}</h3>
                              {survey.description && <p className="text-gray-600 mt-1">{survey.description}</p>}
                              <p className="text-sm text-gray-500 mt-2">
                                문항 수: {survey.survey_questions?.length || 0}개 | 생성일:{" "}
                                {new Date(survey.created_at).toLocaleDateString("ko-KR")}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  survey.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {survey.is_active ? "활성" : "비활성"}
                              </span>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditSurvey(survey)
                                }}
                                size="sm"
                                variant="outline"
                                className="text-xs"
                              >
                                <Edit className="w-3 h-3 mr-1" />
                                수정
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteConfirm(survey)
                                }}
                                size="sm"
                                variant="outline"
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                삭제
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">참여자 CSV 업로드</CardTitle>
                <CardDescription className="text-lg">
                  선택한 설문지에 참여자를 등록합니다. 병원명|대상자이름|휴대폰번호 형식의 CSV 파일을 업로드하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-lg font-medium">설문지 선택 *</Label>
                  <div className="mt-2 p-4 border rounded-lg">
                    {selectedSurvey ? (
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedSurvey.title}</h3>
                          <p className="text-gray-600">{selectedSurvey.description}</p>
                        </div>
                        <Button onClick={() => setSelectedSurvey(null)} variant="outline" size="sm">
                          변경
                        </Button>
                      </div>
                    ) : (
                      <p className="text-gray-500">위의 설문지 관리 탭에서 설문지를 선택해주세요</p>
                    )}
                  </div>
                </div>

                {selectedSurvey && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="csvFile" className="text-lg font-medium">
                          CSV 파일 선택
                        </Label>
                        <Input
                          id="csvFile"
                          type="file"
                          accept=".csv"
                          onChange={handleFileSelect}
                          className="mt-2 h-12 text-lg"
                        />
                      </div>

                      {selectedFile && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <p className="text-lg font-medium text-blue-800">선택된 파일:</p>
                          <p className="text-lg text-blue-600">{selectedFile.name}</p>
                          <p className="text-sm text-blue-500">크기: {(selectedFile.size / 1024).toFixed(2)} KB</p>
                        </div>
                      )}

                      <Button
                        onClick={handleUpload}
                        disabled={!selectedFile || loading}
                        className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                      >
                        {loading ? "업로드 중..." : "CSV 파일 업로드"}
                      </Button>
                    </div>

                    <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                      <h3 className="text-xl font-semibold mb-4">CSV 파일 형식 안내</h3>
                      <div className="space-y-3">
                        <p className="text-lg">
                          <strong>형식:</strong> 병원명|대상자이름|휴대폰번호
                        </p>
                        <p className="text-lg">
                          <strong>예시:</strong>
                        </p>
                        <div className="bg-white p-4 rounded border font-mono text-sm">
                          서울대학교병원|김철수|010-1234-5678
                          <br />
                          연세대학교병원|이영희|010-9876-5432
                          <br />
                          고려대학교병원|박민수|010-5555-6666
                        </div>
                        <p className="text-lg text-red-600">
                          <strong>주의:</strong> 기존 참여자는 초기화되고 새로운 참여자로 교체됩니다.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participants">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">참여자 목록</CardTitle>
                <CardDescription className="text-lg">
                  등록된 참여자들의 정보와 설문 진행 상황을 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedSurvey ? (
                  <div className="text-center py-8">
                    <p className="text-xl text-gray-500">설문지를 선택해주세요</p>
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">
                    <p className="text-xl">데이터를 불러오는 중...</p>
                  </div>
                ) : participants.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xl text-gray-500">등록된 참여자가 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">병원명</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">참여자명</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                            휴대폰번호
                          </th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">상태</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">등록일</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                            설문 링크
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((participant) => (
                          <tr key={participant.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 text-lg">{participant.hospital_name}</td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">{participant.participant_name}</td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">{participant.phone_number}</td>
                            <td className="border border-gray-300 px-4 py-3">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  participant.is_completed
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {participant.is_completed ? "완료" : "미완료"}
                              </span>
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {new Date(participant.created_at).toLocaleDateString("ko-KR")}
                            </td>
                            <td className="border border-gray-300 px-4 py-3">
                              <div className="flex space-x-2">
                                <Button
                                  onClick={() => copyToClipboard(participant.token)}
                                  size="sm"
                                  variant="outline"
                                  className="text-sm"
                                >
                                  <Copy className="w-4 h-4 mr-1" />
                                  링크 복사
                                </Button>
                                <Button
                                  onClick={() => window.open(`/${participant.token}`, "_blank")}
                                  size="sm"
                                  variant="outline"
                                  className="text-sm"
                                >
                                  <ExternalLink className="w-4 h-4 mr-1" />
                                  열기
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="responses">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-2xl">설문 결과</CardTitle>
                    <CardDescription className="text-lg">완료된 설문 응답을 확인하고 다운로드하세요</CardDescription>
                  </div>
                  {responses.length > 0 && (
                    <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700">
                      <Download className="w-4 h-4 mr-2" />
                      CSV 다운로드
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedSurvey ? (
                  <div className="text-center py-8">
                    <p className="text-xl text-gray-500">설문지를 선택해주세요</p>
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">
                    <p className="text-xl">데이터를 불러오는 중...</p>
                  </div>
                ) : responses.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-xl text-gray-500">완료된 설문이 없습니다</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">병원명</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">참여자명</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">
                            휴대폰번호
                          </th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">총점</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">완료일시</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">상세보기</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map((response: any) => (
                          <tr key={response.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {response.survey_participants?.hospital_name || ""}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {response.survey_participants?.participant_name || ""}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {response.survey_participants?.phone_number || ""}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {response.total_score || 0} / {response.max_possible_score || 0}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {new Date(response.created_at).toLocaleString("ko-KR")}
                            </td>
                            <td className="border border-gray-300 px-4 py-3">
                              <Button
                                onClick={() => openDetailModal(response)}
                                size="sm"
                                variant="outline"
                                className="text-sm"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                상세보기
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-2xl">통계</CardTitle>
                      <CardDescription className="text-lg">설문 결과에 대한 상세 통계를 확인하세요</CardDescription>
                    </div>
                    {selectedSurvey && responses.length > 0 && (
                      <Button onClick={downloadStatsExcel} className="bg-green-600 hover:bg-green-700">
                        <Download className="w-4 h-4 mr-2" />
                        통계 엑셀 다운로드
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedSurvey ? (
                    <div className="text-center py-8">
                      <p className="text-xl text-gray-500">설문지를 선택해주세요</p>
                    </div>
                  ) : responses.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xl text-gray-500">통계를 표시할 데이터가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {/* 기본 통계 */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-blue-50 p-6 rounded-lg">
                          <h3 className="text-lg font-semibold text-blue-800">총 참여자</h3>
                          <p className="text-3xl font-bold text-blue-600">{participants.length}명</p>
                        </div>
                        <div className="bg-green-50 p-6 rounded-lg">
                          <h3 className="text-lg font-semibold text-green-800">완료된 설문</h3>
                          <p className="text-3xl font-bold text-green-600">{responses.length}명</p>
                        </div>
                        <div className="bg-yellow-50 p-6 rounded-lg">
                          <h3 className="text-lg font-semibold text-yellow-800">완료율</h3>
                          <p className="text-3xl font-bold text-yellow-600">
                            {participants.length > 0 ? Math.round((responses.length / participants.length) * 100) : 0}%
                          </p>
                        </div>
                        <div className="bg-purple-50 p-6 rounded-lg">
                          <h3 className="text-lg font-semibold text-purple-800">평균 점수</h3>
                          <p className="text-3xl font-bold text-purple-600">
                            {responses.length > 0
                              ? (
                                  responses.reduce((sum: number, r: any) => sum + (r.total_score || 0), 0) /
                                  responses.length
                                ).toFixed(1)
                              : "0"}
                            /{responses.length > 0 ? responses[0].max_possible_score : 0}
                          </p>
                        </div>
                      </div>

                      {/* 문항별 평균점수 (병원별 필터링) */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-semibold">문항별 평균점수</h3>
                          <div className="flex items-center space-x-2">
                            <Label htmlFor="hospitalFilter" className="text-sm">
                              병원 필터:
                            </Label>
                            <Input
                              id="hospitalFilter"
                              value={hospitalFilter}
                              onChange={(e) => setHospitalFilter(e.target.value)}
                              placeholder="병원명 입력"
                              className="w-48"
                            />
                          </div>
                        </div>
                        {questionStats.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                    문항 번호
                                  </th>
                                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                    문항 내용
                                  </th>
                                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">응답 수</th>
                                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">
                                    평균 점수
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {questionStats.map((stat) => (
                                  <tr key={stat.id} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-4 py-3">{stat.questionNumber}</td>
                                    <td className="border border-gray-300 px-4 py-3">{stat.questionText}</td>
                                    <td className="border border-gray-300 px-4 py-3">{stat.totalResponses}</td>
                                    <td className="border border-gray-300 px-4 py-3">
                                      {stat.averageScore}/{stat.maxScore}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-gray-500">문항별 통계 데이터가 없습니다.</p>
                        )}
                      </div>

                      {/* 병원별 통계 */}
                      <div>
                        <h3 className="text-xl font-semibold mb-4">병원별 통계</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">병원명</th>
                                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">응답 수</th>
                                <th className="border border-gray-300 px-4 py-3 text-left font-semibold">평균 점수</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(
                                responses.reduce((acc: any, response: any) => {
                                  const hospital = response.survey_participants?.hospital_name || "알 수 없음"
                                  if (!acc[hospital]) {
                                    acc[hospital] = { count: 0, totalScore: 0, maxScore: response.max_possible_score }
                                  }
                                  acc[hospital].count += 1
                                  acc[hospital].totalScore += response.total_score || 0
                                  return acc
                                }, {}),
                              ).map(([hospital, stats]: [string, any]) => (
                                <tr key={hospital} className="hover:bg-gray-50">
                                  <td className="border border-gray-300 px-4 py-3">{hospital}</td>
                                  <td className="border border-gray-300 px-4 py-3">{stats.count}</td>
                                  <td className="border border-gray-300 px-4 py-3">
                                    {(stats.totalScore / stats.count).toFixed(1)}/{stats.maxScore}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* 수정 모달 */}
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>설문지 수정</DialogTitle>
              <DialogDescription>설문지 정보를 수정하세요</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editTitle">설문지 제목 *</Label>
                <Input
                  id="editTitle"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="editDescription">설문지 설명</Label>
                <Textarea
                  id="editDescription"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>설문 문항 *</Label>
                  <Button onClick={addEditQuestion} size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-1" />
                    문항 추가
                  </Button>
                </div>
                <div className="space-y-2">
                  {editQuestions.map((question, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={question}
                        onChange={(e) => updateEditQuestion(index, e.target.value)}
                        placeholder={`문항 ${index + 1}`}
                        className="flex-1"
                      />
                      {editQuestions.length > 1 && (
                        <Button onClick={() => removeEditQuestion(index)} size="sm" variant="outline">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>
                취소
              </Button>
              <Button onClick={handleSaveEdit} disabled={editLoading}>
                {editLoading ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 삭제 확인 다이얼로그 */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>설문지 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                정말로 이 설문지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                <br />
                <br />
                삭제하려면 관리자 비밀번호를 입력하세요:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="my-4">
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="관리자 비밀번호"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletePassword("")
                }}
              >
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSurvey}
                disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleteLoading ? "삭제 중..." : "삭제"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 상세보기 모달 */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>설문 응답 상세</DialogTitle>
            </DialogHeader>
            {selectedResponse && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>병원명</Label>
                    <p className="text-lg">{selectedResponse.survey_participants?.hospital_name || ""}</p>
                  </div>
                  <div>
                    <Label>참여자명</Label>
                    <p className="text-lg">{selectedResponse.survey_participants?.participant_name || ""}</p>
                  </div>
                  <div>
                    <Label>휴대폰번호</Label>
                    <p className="text-lg">{selectedResponse.survey_participants?.phone_number || ""}</p>
                  </div>
                  <div>
                    <Label>완료일시</Label>
                    <p className="text-lg">{new Date(selectedResponse.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                </div>
                <div>
                  <Label>총점</Label>
                  <p className="text-2xl font-bold">
                    {selectedResponse.total_score || 0} / {selectedResponse.max_possible_score || 0}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setShowDetailModal(false)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
