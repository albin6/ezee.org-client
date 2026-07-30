import React, { useEffect, useState } from 'react';
import { Card, Table, Input, Select, DatePicker, Button, Space, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { foundationService } from '../api/foundation.service';
import { ResultDetailsModal } from '../components/ResultDetailsModal';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

export const ResultsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const [examType, setExamType] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, [page, limit, search, status, examType, dateRange, sortBy, sortOrder]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
        examType: examType || undefined,
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

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
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
    <div style={{ padding: '24px' }}>
      <Card title="Foundation Results">
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search student, batch, coordinator..."
            prefix={<SearchOutlined />}
            onPressEnter={(e: any) => setSearch(e.target.value)}
            onBlur={(e: any) => setSearch(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 120 }}
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
          <RangePicker onChange={setDateRange as any} />
          <Button icon={<ReloadOutlined />} onClick={fetchResults}>
            Refresh
          </Button>
        </Space>

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
      </Card>

      <ResultDetailsModal
        open={!!selectedResultId}
        resultId={selectedResultId}
        onClose={() => setSelectedResultId(null)}
      />
    </div>
  );
};
