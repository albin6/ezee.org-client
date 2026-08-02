/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { Table, Card, Input, Select, DatePicker, Button, Tag, Grid, List } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { foundationService } from '../api/foundation.service';
import { ResultDetailsModal } from '../components/ResultDetailsModal';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export const ResultsPage: React.FC = () => {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [examType, setExamType] = useState<string | undefined>();
  const [batchId, setBatchId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [batches, setBatches] = useState<any[]>([]);

  const fetchBatches = async () => {
    try {
      const res = await foundationService.getBatches({ limit: 100 });
      setBatches(res.data || []);
    } catch (error) {
      console.error('Failed to fetch batches', error);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
        examType: examType || undefined,
        batchId: batchId || undefined,
        sortBy,
        sortOrder,
      };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].startOf('day').toISOString();
        params.endDate = dateRange[1].endOf('day').toISOString();
      }
      const res = await foundationService.getResults(params);
      setData(res.data);
      setTotal(res.total);
    } catch (error) {
      console.error('Failed to fetch results', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [page, limit, search, status, examType, batchId, dateRange, sortBy, sortOrder]);

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleTableChange = (pagination: any, _filters: any, sorter: any) => {
    setPage(pagination.current);
    setLimit(pagination.pageSize);
    if (sorter.field) {
      setSortBy(sorter.field);
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc');
    }
  };

  const columns = [
    {
      title: 'Student Name',
      dataIndex: ['student', 'name'],
      key: 'studentName',
      sorter: true,
    },
    {
      title: 'Batch',
      dataIndex: ['batch', 'name'],
      key: 'batch',
      sorter: true,
    },
    {
      title: 'Exam Type',
      dataIndex: 'examType',
      key: 'examType',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'resultStatus',
      sorter: true,
      render: (val: string) => (
        <Tag color={val === 'PASS' ? 'success' : 'error'}>{val}</Tag>
      ),
    },
    {
      title: 'Submitted By',
      dataIndex: ['coordinator', 'name'],
      key: 'coordinator',
    },
    {
      title: 'Submitted At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      render: (val: string) => dayjs(val).format('DD MMM YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type="link" onClick={() => setSelectedResultId(record.id)}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6">
      <Card title="Foundation Results" className="w-full">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 mb-6">
          <Input
            placeholder="Search student, batch, coordinator..."
            prefix={<SearchOutlined />}
            onPressEnter={(e: any) => setSearch(e.target.value)}
            onBlur={(e: any) => setSearch(e.target.value)}
            className="w-full sm:w-64"
            allowClear
          />
          <Select
            placeholder="Status"
            allowClear
            className="w-full sm:w-32"
            onChange={setStatus}
            options={[
              { label: 'Pass', value: 'PASS' },
              { label: 'Fail', value: 'FAIL' },
            ]}
          />
          <Select
            placeholder="Exam Type"
            allowClear
            style={{ width: 150 }}
            onChange={setExamType}
            options={[
              { label: 'Mock Exam', value: 'MOCK' },
              { label: 'Final Exam', value: 'FINAL' },
            ]}
          />
          <Select
            placeholder="Batch"
            allowClear
            showSearch
            className="w-full sm:w-48"
            onChange={setBatchId}
            options={Array.isArray(batches) ? batches.map((b) => ({ label: b.name, value: b.id })) : []}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <RangePicker className="w-full sm:w-auto" onChange={setDateRange as any} />
          <Button icon={<ReloadOutlined />} onClick={fetchResults} className="w-full sm:w-auto">
            Refresh
          </Button>
        </div>

        {isMobile ? (
          <List
            grid={{ gutter: 16, column: 1 }}
            dataSource={data}
            loading={loading}
            pagination={{
              current: page,
              pageSize: limit,
              total,
              onChange: (p, s) => { setPage(p); setLimit(s); }
            }}
            renderItem={record => (
              <List.Item>
                <Card 
                  title={record.student?.name || 'Unknown Student'}
                  extra={
                    <Tag color={record.status === 'PASS' ? 'green' : 'red'}>
                      {record.status}
                    </Tag>
                  }
                  actions={[
                    <Button key="details" type="link" onClick={() => setSelectedResultId(record.id)}>
                      View Details
                    </Button>
                  ]}
                >
                  <p className="text-gray-500 mb-1">Batch: {record.thread?.batch?.name || 'Unknown'}</p>
                  <p className="text-gray-500 mb-1">Exam: {record.examType}</p>
                  <p className="text-gray-500 mb-1">Score: {record.finalScore} / {record.totalMaxMarks}</p>
                  <p className="text-gray-400 text-sm">{dayjs(record.createdAt).format('MMM D, YYYY')}</p>
                </Card>
              </List.Item>
            )}
          />
        ) : (
          <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: true,
          }}
          scroll={{ x: 800 }}
        />
        )}
      </Card>

      <ResultDetailsModal
        open={!!selectedResultId}
        resultId={selectedResultId}
        onClose={() => setSelectedResultId(null)}
      />
    </div>
  );
};
