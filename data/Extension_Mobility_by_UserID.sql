SELECT
  eu.userid,
  emd.logintime,
  emd.loginduration,
  emd.datetimestamp
FROM
  extensionmobilitydynamic emd
  INNER JOIN enduser eu ON emd.fkenduser_lastlogin = eu.pkid
WHERE
  eu.userid = 'USERID' -- Add your USERID here