"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { supabase } from "@/lib/supabase/client"
// 아이콘 추가
import { Copy, Download, ExternalLink, Eye } from "lucide-react"

const ADMIN_PASSWORD = "hospital2024" // 실제 운영시에는 환경변수로 관리

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [participants, setParticipants] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  // 상세 보기 상태 추가
  const [selectedResponse, setSelectedResponse] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("비밀번호가 올바르지 않습니다.")
    }
  }

  const fetchParticipants = async () => {
    if (!supabase) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("survey_participants")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setParticipants(data || [])
    } catch (err) {
      setError("참여자 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const fetchResponses = async () => {
    if (!supabase) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("survey_responses")
        .select(`
          *,
          survey_participants (
            hospital_name,
            participant_name,
            phone_number
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setResponses(data || [])
    } catch (err) {
      setError("설문 응답 데이터를 불러오는데 실패했습니다.")
    } finally {
      setLoading(false)
    }
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

    setUploadLoading(true)
    setError("")
    setUploadSuccess("")

    try {
      const formData = new FormData()
      formData.append("csvFile", selectedFile)

      const response = await fetch("/api/admin/upload-csv", {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadSuccess(result.message)
        setSelectedFile(null)
        const fileInput = document.getElementById("csvFile") as HTMLInputElement
        if (fileInput) fileInput.value = ""
        fetchParticipants()
      } else {
        setError(result.error || "업로드 중 오류가 발생했습니다.")
      }
    } catch (err) {
      setError("업로드 중 오류가 발생했습니다.")
    } finally {
      setUploadLoading(false)
    }
  }

  // 설문 링크 복사 기능 추가
  const copyToClipboard = async (token: string) => {
    const surveyUrl = `${window.location.origin}?token=${token}`
    try {
      await navigator.clipboard.writeText(surveyUrl)
      alert("설문 링크가 클립보드에 복사되었습니다!")
    } catch (err) {
      alert("링크 복사에 실패했습니다.")
    }
  }

  // CSV 다운로드 기능 추가
  const downloadCSV = () => {
    if (responses.length === 0) {
      alert("다운로드할 데이터가 없습니다.")
      return
    }

    const headers = [
      "병원명",
      "참여자명",
      "휴대폰번호",
      "문항1",
      "문항2",
      "문항3",
      "문항4",
      "문항5",
      "문항6",
      "문항7",
      "문항8",
      "문항9",
      "총점",
      "완료일시",
    ]

    const csvData = responses.map((response: any) => [
      response.survey_participants?.hospital_name || "",
      response.survey_participants?.participant_name || "",
      response.survey_participants?.phone_number || "",
      response.question_1 || "",
      response.question_2 || "",
      response.question_3 || "",
      response.question_4 || "",
      response.question_5 || "",
      response.question_6 || "",
      response.question_7 || "",
      response.question_8 || "",
      response.question_9 || "",
      response.total_score || "",
      new Date(response.created_at).toLocaleString("ko-KR"),
    ])

    const csvContent = [headers, ...csvData].map((row) => row.map((field) => `"${field}"`).join(",")).join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `병원만족도조사_결과_${new Date().toISOString().split("T")[0]}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 상세 보기 모달 열기
  const openDetailModal = (response: any) => {
    setSelectedResponse(response)
    setShowDetailModal(true)
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchParticipants()
      fetchResponses()
    }
  }, [isAuthenticated])

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

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 h-12">
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

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">참여자 CSV 업로드</CardTitle>
                <CardDescription className="text-lg">
                  병원명, 대상자이름, 휴대폰번호 형식의 CSV 파일을 업로드하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                    disabled={!selectedFile || uploadLoading}
                    className="w-full h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {uploadLoading ? "업로드 중..." : "CSV 파일 업로드"}
                  </Button>
                </div>

                {uploadSuccess && (
                  <Alert className="border-green-200 bg-green-50">
                    <AlertDescription className="text-green-700 text-lg">{uploadSuccess}</AlertDescription>
                  </Alert>
                )}

                <div className="mt-8 p-6 bg-gray-50 rounded-lg">
                  <h3 className="text-xl font-semibold mb-4">CSV 파일 형식 안내</h3>
                  <div className="space-y-3">
                    <p className="text-lg">
                      <strong>형식:</strong> 병원명, 대상자이름, 휴대폰번호
                    </p>
                    <p className="text-lg">
                      <strong>예시:</strong>
                    </p>
                    <div className="bg-white p-4 rounded border font-mono text-sm">
                      서울대학교병원, 김철수, 010-1234-5678
                      <br />
                      연세대학교병원, 이영희, 010-9876-5432
                      <br />
                      고려대학교병원, 박민수, 010-5555-1234
                    </div>
                    <p className="text-sm text-gray-600">
                      * 첫 번째 줄부터 데이터를 입력하세요 (헤더 없음)
                      <br />* 각 항목은 쉼표(,)로 구분합니다
                      <br />* 특수문자가 포함된 경우 따옴표로 감싸주세요
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="participants">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">참여자 목록</CardTitle>
                <CardDescription className="text-lg">등록된 참여자와 토큰 정보를 확인할 수 있습니다</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
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
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">완료여부</th>
                          {/* 액션 컬럼 추가 */}
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {participants.map((participant: any) => (
                          <tr key={participant.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 text-lg">{participant.hospital_name}</td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">{participant.participant_name}</td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">{participant.phone_number}</td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  participant.survey_completed
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {participant.survey_completed ? "완료" : "미완료"}
                              </span>
                            </td>
                            {/* 링크 복사 버튼 추가 */}
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
                                  onClick={() =>
                                    window.open(`${window.location.origin}?token=${participant.token}`, "_blank")
                                  }
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
                    <CardTitle className="text-2xl">설문 응답 결과</CardTitle>
                    <CardDescription className="text-lg">완료된 설문 응답을 확인할 수 있습니다</CardDescription>
                  </div>
                  {/* CSV 다운로드 버튼 추가 */}
                  {responses.length > 0 && (
                    <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700">
                      <Download className="w-4 h-4 mr-2" />
                      CSV 다운로드
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
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
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">총점</th>
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">완료일시</th>
                          {/* 상세보기 컬럼 추가 */}
                          <th className="border border-gray-300 px-4 py-3 text-left text-lg font-semibold">상세보기</th>
                        </tr>
                      </thead>
                      <tbody>
                        {responses.map((response: any) => (
                          <tr key={response.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {response.survey_participants?.hospital_name}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {response.survey_participants?.participant_name}
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg font-semibold">
                              {response.total_score}/45
                            </td>
                            <td className="border border-gray-300 px-4 py-3 text-lg">
                              {new Date(response.created_at).toLocaleString("ko-KR")}
                            </td>
                            {/* 상세보기 버튼 추가 */}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">통계 정보</CardTitle>
                <CardDescription className="text-lg">설문 참여 현황과 통계를 확인할 수 있습니다</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-blue-50 p-6 rounded-lg text-center">
                    <h3 className="text-2xl font-bold text-blue-600 mb-2">{participants.length}</h3>
                    <p className="text-lg text-blue-800">총 참여자 수</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg text-center">
                    <h3 className="text-2xl font-bold text-green-600 mb-2">{responses.length}</h3>
                    <p className="text-lg text-green-800">완료된 설문 수</p>
                  </div>
                  <div className="bg-orange-50 p-6 rounded-lg text-center">
                    <h3 className="text-2xl font-bold text-orange-600 mb-2">
                      {participants.length > 0 ? Math.round((responses.length / participants.length) * 100) : 0}%
                    </h3>
                    <p className="text-lg text-orange-800">완료율</p>
                  </div>
                </div>

                {/* 추가 통계 정보 */}
                {responses.length > 0 && (
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg border">
                      <h3 className="text-xl font-semibold mb-4">평균 점수 분석</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-purple-50 p-4 rounded-lg">
                          <h4 className="text-lg font-medium text-purple-800 mb-2">전체 평균 점수</h4>
                          <p className="text-2xl font-bold text-purple-600">
                            {responses.length > 0
                              ? (
                                  responses.reduce((sum: number, r: any) => sum + (r.total_score || 0), 0) /
                                  responses.length
                                ).toFixed(1)
                              : 0}
                            /45
                          </p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-lg">
                          <h4 className="text-lg font-medium text-indigo-800 mb-2">만족도 비율</h4>
                          <p className="text-2xl font-bold text-indigo-600">
                            {responses.length > 0
                              ? (
                                  (responses.reduce((sum: number, r: any) => sum + (r.total_score || 0), 0) /
                                    responses.length /
                                    45) *
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg border">
                      <h3 className="text-xl font-semibold mb-4">병원별 통계</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 px-4 py-2 text-left">병원명</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">응답 수</th>
                              <th className="border border-gray-300 px-4 py-2 text-left">평균 점수</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(
                              responses.reduce((acc: any, response: any) => {
                                const hospital = response.survey_participants?.hospital_name || "알 수 없음"
                                if (!acc[hospital]) {
                                  acc[hospital] = { count: 0, totalScore: 0 }
                                }
                                acc[hospital].count += 1
                                acc[hospital].totalScore += response.total_score || 0
                                return acc
                              }, {}),
                            ).map(([hospital, stats]: [string, any]) => (
                              <tr key={hospital} className="hover:bg-gray-50">
                                <td className="border border-gray-300 px-4 py-2">{hospital}</td>
                                <td className="border border-gray-300 px-4 py-2">{stats.count}</td>
                                <td className="border border-gray-300 px-4 py-2 font-semibold">
                                  {(stats.totalScore / stats.count).toFixed(1)}/45
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
          </TabsContent>
        </Tabs>

        {/* 상세보기 모달 추가 */}
        {showDetailModal && selectedResponse && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">설문 응답 상세</h2>
                  <Button onClick={() => setShowDetailModal(false)} variant="outline" size="sm">
                    닫기
                  </Button>
                </div>

                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2">참여자 정보</h3>
                    <p>
                      <strong>병원명:</strong> {selectedResponse.survey_participants?.hospital_name}
                    </p>
                    <p>
                      <strong>참여자명:</strong> {selectedResponse.survey_participants?.participant_name}
                    </p>
                    <p>
                      <strong>완료일시:</strong> {new Date(selectedResponse.created_at).toLocaleString("ko-KR")}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4">문항별 응답</h3>
                    <div className="space-y-3">
                      {[
                        "병원 직원들이 친절하게 대해주었습니까?",
                        "진료 대기시간이 적절했습니까?",
                        "의료진의 설명이 이해하기 쉬웠습니까?",
                        "병원 시설이 깨끗하고 쾌적했습니까?",
                        "진료 결과에 만족하십니까?",
                        "병원 접근성(교통, 주차 등)이 편리했습니까?",
                        "예약 및 접수 과정이 편리했습니까?",
                        "병원비가 적절하다고 생각하십니까?",
                        "이 병원을 다른 사람에게 추천하시겠습니까?",
                      ].map((question, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-white rounded border">
                          <span className="text-sm">{`${index + 1}. ${question}`}</span>
                          <span className="font-bold text-lg">{selectedResponse[`question_${index + 1}`] || 0}점</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-green-100 rounded text-center">
                      <span className="text-xl font-bold text-green-800">
                        총점: {selectedResponse.total_score}/45점
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
